'use strict';

// ====== Constantes y Referencias al DOM ======
const RUTA_DATOS = "data/productos.json";
const TODAS = "Todas";

const contFiltros = document.querySelector("#filtros");
const grilla = document.querySelector("#grilla");
const estado = document.querySelector("#estado");
const plantilla = document.querySelector("#tpl-producto");
const tplSkeleton = document.querySelector("#tpl-skeleton");

// Controles Adicionales
const inputBuscar = document.querySelector("#buscar");
const selectOrden = document.querySelector("#orden");
const chkDisponibles = document.querySelector("#chkDisponibles");

// Modal Nativo
const modalProducto = document.querySelector("#modalProducto");
const btnCerrarModal = document.querySelector("#btnCerrarModal");
const modalImg = document.querySelector("#modalImg");
const modalEtiqueta = document.querySelector("#modalEtiqueta");
const modalCategoria = document.querySelector("#modalCategoria");
const modalNombre = document.querySelector("#modalNombre");
const modalDescripcion = document.querySelector("#modalDescripcion");
const modalPrecio = document.querySelector("#modalPrecio");
const modalPorciones = document.querySelector("#modalPorciones");
const modalStock = document.querySelector("#modalStock");

// ====== Estado de la Aplicación ======
let productos = [];
let categoriaActiva = TODAS;
let elementoInvocadorModal = null;

// Formateador de moneda es-PE
const soles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

// ====== 1. Carga de datos y Validación defensiva ======
function validarProducto(p) {
  if (typeof p.id !== 'number' || isNaN(p.id)) return false;
  if (!p.nombre || typeof p.nombre !== 'string') return false;
  if (!p.categoria || typeof p.categoria !== 'string') return false;
  if (typeof p.precio !== 'number' || p.precio <= 0) return false;
  if (!Number.isInteger(p.stock) || p.stock < 0) return false;
  if (!p.imagen || !/\.(jpg|jpeg|png|webp)$/i.test(p.imagen)) return false;
  return true;
}

async function cargarProductos() {
  const respuesta = await fetch(RUTA_DATOS);
  if (!respuesta.ok) {
    throw new Error(`No se pudo leer ${RUTA_DATOS} (HTTP ${respuesta.status})`);
  }
  const datos = await respuesta.json();
  if (!Array.isArray(datos)) {
    throw new Error("El archivo JSON debe contener un arreglo de productos");
  }

  // Filtrado defensivo de productos inválidos
  const idsVistos = new Set();
  const productosValidos = datos.filter((p) => {
    const esValido = validarProducto(p) && !idsVistos.has(p.id);
    if (esValido) {
      idsVistos.add(p.id);
    } else {
      console.warn("Producto inválido o con ID duplicado descartado:", p);
    }
    return esValido;
  });

  return productosValidos;
}

// ====== 2. Skeletons de Carga ======
function mostrarSkeletons(cantidad = 8) {
  grilla.setAttribute("aria-busy", "true");
  const fragmento = document.createDocumentFragment();
  for (let i = 0; i < cantidad; i++) {
    fragmento.append(tplSkeleton.content.cloneNode(true));
  }
  grilla.replaceChildren(fragmento);
}

// ====== 3. Gestión de Categorías y URL Hash ======
function obtenerCategorias(lista) {
  return [TODAS, ...new Set(lista.map((p) => p.categoria))];
}

function inicializarHash(categoriasValidas) {
  const hashRaw = location.hash.slice(1);
  const hashDecodificado = decodeURIComponent(hashRaw);
  if (categoriasValidas.includes(hashDecodificado)) {
    categoriaActiva = hashDecodificado;
  } else {
    categoriaActiva = TODAS;
    if (hashRaw) history.replaceState(null, "", "#" + encodeURIComponent(TODAS));
  }
}

function renderizarFiltros(categorias) {
  const fragmento = document.createDocumentFragment();
  categorias.forEach((cat) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "filtro";
    boton.dataset.categoria = cat;
    boton.setAttribute("aria-pressed", String(cat === categoriaActiva));
    fragmento.append(boton);
  });
  contFiltros.replaceChildren(fragmento);
  actualizarContadores();
}

// Recálculo dinámico de contadores sin regenerar botones
function actualizarContadores() {
  const textoBusqueda = inputBuscar.value.trim().toLowerCase();
  const soloDisponibles = chkDisponibles.checked;

  const baseFiltrada = productos.filter((p) => {
    const coincideTexto = p.nombre.toLowerCase().includes(textoBusqueda);
    const coincideStock = !soloDisponibles || p.stock > 0;
    return coincideTexto && coincideStock;
  });

  const botones = contFiltros.querySelectorAll(".filtro");
  botones.forEach((btn) => {
    const cat = btn.dataset.categoria;
    const total = cat === TODAS 
      ? baseFiltrada.length 
      : baseFiltrada.filter((p) => p.categoria === cat).length;
    
    btn.textContent = `${cat} (${total})`;
  });
}

// ====== 4. Creación de Tarjetas ======
function crearTarjeta(p) {
  const nodo = plantilla.content.cloneNode(true);
  const tarjeta = nodo.querySelector(".tarjeta");
  const btnDetalle = nodo.querySelector(".tarjeta-btn-detalle");
  const img = nodo.querySelector("img");
  const etiqueta = nodo.querySelector(".etiqueta");

  btnDetalle.dataset.id = p.id;
  
  // Soporte de Responsive Images (srcset / sizes)
  img.src = p.imagen;
  img.srcset = `${p.imagen} 600w`;
  img.sizes = "(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw";
  img.alt = p.nombre;

  // Manejo de carga e imagen de respaldo
  img.addEventListener("load", () => img.classList.add("foto-cargada"));
  img.onerror = () => {
    img.onerror = null;
    img.src = "img/sin-imagen.jpg";
    img.srcset = "img/sin-imagen.jpg 600w";
  };

  nodo.querySelector(".tarjeta_categoria").textContent = p.categoria;
  nodo.querySelector(".tarjeta_nombre").textContent = p.nombre;
  nodo.querySelector(".tarjeta_descripcion").textContent = p.descripcion;
  nodo.querySelector(".tarjeta_precio").textContent = soles.format(p.precio);
  nodo.querySelector(".tarjeta_porciones").textContent =
    p.porciones > 1 ? `${p.porciones} porciones` : "1 unidad";

  if (p.stock === 0) {
    etiqueta.textContent = "Agotado";
    etiqueta.classList.add("etiqueta--agotado");
    etiqueta.hidden = false;
    tarjeta.classList.add("tarjeta--agotado");
  } else if (p.destacado) {
    etiqueta.textContent = "Favorito";
    etiqueta.hidden = false;
  }

  return nodo;
}

// ====== 5. Renderizado y Ordenamiento ======
function obtenerProductosFiltradosYOrdenados() {
  const textoBusqueda = inputBuscar.value.trim().toLowerCase();
  const soloDisponibles = chkDisponibles.checked;
  const criterioOrden = selectOrden.value;

  // 1. Filtrar
  let resultado = productos.filter((p) => {
    const cumpleCategoria = categoriaActiva === TODAS || p.categoria === categoriaActiva;
    const cumpleTexto = p.nombre.toLowerCase().includes(textoBusqueda);
    const cumpleStock = !soloDisponibles || p.stock > 0;
    return cumpleCategoria && cumpleTexto && cumpleStock;
  });

  // 2. Ordenar copia del arreglo
  resultado = [...resultado].sort((a, b) => {
    if (criterioOrden === "precio-asc") return a.precio - b.precio;
    if (criterioOrden === "precio-desc") return b.precio - a.precio;
    if (criterioOrden === "nombre-asc") return a.nombre.localeCompare(b.nombre, "es");
    return 0; // por defecto
  });

  return resultado;
}

function renderizarCatalogo() {
  const lista = obtenerProductosFiltradosYOrdenados();
  actualizarContadores();

  if (lista.length === 0) {
    grilla.replaceChildren();
    estado.textContent = "No se encontraron productos que coincidan con los criterios.";
    return;
  }

  const fragmento = document.createDocumentFragment();
  lista.forEach((p) => fragmento.append(crearTarjeta(p)));
  grilla.replaceChildren(fragmento);

  const textoCat = categoriaActiva === TODAS ? "en total" : `en «${categoriaActiva}»`;
  estado.textContent = `Mostrando ${lista.length} productos ${textoCat}.`;
}

// ====== 6. Delegación de Eventos y Modal Nativo ======
contFiltros.addEventListener("click", (evento) => {
  const boton = evento.target.closest(".filtro");
  if (!boton || boton.dataset.categoria === categoriaActiva) return;

  categoriaActiva = boton.dataset.categoria;
  history.replaceState(null, "", "#" + encodeURIComponent(categoriaActiva));

  contFiltros.querySelectorAll(".filtro").forEach((b) => {
    b.setAttribute("aria-pressed", String(b === boton));
  });

  renderizarCatalogo();
});

// Eventos de Filtro y Orden (Input, Select, Checkbox)
inputBuscar.addEventListener("input", renderizarCatalogo);
selectOrden.addEventListener("change", renderizarCatalogo);
chkDisponibles.addEventListener("change", renderizarCatalogo);

// Abrir Modal Nativo (<dialog>) mediante delegación en #grilla
grilla.addEventListener("click", (evento) => {
  const btnDetalle = evento.target.closest(".tarjeta-btn-detalle");
  if (!btnDetalle) return;

  const id = Number(btnDetalle.dataset.id);
  const p = productos.find((prod) => prod.id === id);
  if (!p) return;

  elementoInvocadorModal = btnDetalle;

  modalImg.src = p.imagen;
  modalImg.alt = p.nombre;
  modalCategoria.textContent = p.categoria;
  modalNombre.textContent = p.nombre;
  modalDescripcion.textContent = p.descripcion;
  modalPrecio.textContent = soles.format(p.precio);
  modalPorciones.textContent = p.porciones > 1 ? `${p.porciones} porciones` : "1 unidad";
  modalStock.textContent = p.stock > 0 ? `Stock disponible: ${p.stock} unidades` : "Producto Agotado";

  if (p.stock === 0) {
    modalEtiqueta.textContent = "Agotado";
    modalEtiqueta.className = "etiqueta etiqueta--agotado";
    modalEtiqueta.hidden = false;
  } else if (p.destacado) {
    modalEtiqueta.textContent = "Favorito";
    modalEtiqueta.className = "etiqueta";
    modalEtiqueta.hidden = false;
  } else {
    modalEtiqueta.hidden = true;
  }

  modalProducto.showModal();
});

// Cerrar Modal Nativo y devolver foco
function cerrarModal() {
  modalProducto.close();
  if (elementoInvocadorModal) {
    elementoInvocadorModal.focus();
  }
}

btnCerrarModal.addEventListener("click", cerrarModal);
modalProducto.addEventListener("cancel", (e) => {
  e.preventDefault();
  cerrarModal();
});

// ====== 7. Inicialización y Gestión de Errores ======
async function iniciar() {
  estado.classList.remove("estado--error");
  estado.textContent = "Cargando productos...";
  mostrarSkeletons(8);

  try {
    productos = await cargarProductos();
    const categorias = obtenerCategorias(productos);
    
    inicializarHash(categorias);
    renderizarFiltros(categorias);
    renderizarCatalogo();
  } catch (error) {
    console.error(error);
    grilla.replaceChildren();
    
    estado.classList.add("estado--error");
    estado.innerHTML = `
      No se pudo cargar el catálogo. Verifique su conexión o la disponibilidad del servidor.<br>
      <button type="button" id="btnReintentar" class="btn-reintentar">Reintentar</button>
    `;

    document.querySelector("#btnReintentar")?.addEventListener("click", iniciar);
  } finally {
    grilla.setAttribute("aria-busy", "false");
  }
}

iniciar();
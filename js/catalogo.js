const TODOS = "Todas";
let productos = [];
let categoriaActiva = TODOS;
let ultimoElementoFocado = null;

// Referencias al DOM
const grilla = document.getElementById("grilla");
const estado = document.getElementById("estado");
const contFiltros = document.getElementById("filtros");
const buscador = document.getElementById("buscador");
const ordenSelect = document.getElementById("orden");
const chkDisponibles = document.getElementById("solo-disponibles");
const plantilla = document.getElementById("plantilla-tarjeta");

// Referencias Modal
const modal = document.getElementById("modal-producto");
const modalImg = document.getElementById("modal-img");
const modalCategoria = document.getElementById("modal-categoria");
const modalNombre = document.getElementById("modal-nombre");
const modalDescripcion = document.getElementById("modal-descripcion");
const modalPrecio = document.getElementById("modal-precio");
const modalStock = document.getElementById("modal-stock");
const btnCerrarModal = document.getElementById("btn-cerrar-modal");

const formatearSoles = (monto) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(monto);

function validarProducto(p) {
  const extensionesValidas = /\.(jpg|jpeg|png|webp|svg)$/i;
  const esIdValido = typeof p.id === "number" && p.id > 0;
  const esPrecioValido = typeof p.precio === "number" && p.precio > 0;
  const esStockValido = Number.isInteger(p.stock) && p.stock >= 0;
  const esCategoriaValida = typeof p.categoria === "string" && p.categoria.trim() !== "";
  const esImagenValida = typeof p.imagen === "string" && extensionesValidas.test(p.imagen);

  return esIdValido && esPrecioValido && esStockValido && esCategoriaValida && esImagenValida;
}

async function cargarProductos() {
  const res = await fetch("data/productos.json");
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const datos = await res.json();

  if (!Array.isArray(datos)) throw new Error("El JSON recibido no es una lista válida.");

  const validos = [];
  const idsVistos = new Set();

  datos.forEach((p) => {
    if (validarProducto(p) && !idsVistos.has(p.id)) {
      idsVistos.add(p.id);
      validos.push(p);
    } else {
      console.warn("Producto inválido descartado:", p);
    }
  });

  return validos;
}

function obtenerCategorias(lista) {
  const cats = new Set(lista.map((p) => p.categoria));
  return [TODOS, ...Array.from(cats)];
}

function renderizarFiltros(categorias) {
  const fragmento = document.createDocumentFragment();

  categorias.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filtro";
    btn.dataset.categoria = cat;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(cat === categoriaActiva));
    btn.setAttribute("aria-pressed", String(cat === categoriaActiva));
    btn.textContent = cat;
    fragmento.append(btn);
  });

  contFiltros.replaceChildren(fragmento);
}

function actualizarContadores() {
  const textoBusqueda = buscador.value.trim().toLowerCase();
  const soloDisponibles = chkDisponibles.checked;

  const botones = contFiltros.querySelectorAll(".filtro");
  botones.forEach((btn) => {
    const cat = btn.dataset.categoria;
    const conteo = productos.filter((p) => {
      const coincideCat = cat === TODOS || p.categoria === cat;
      const coincideNombre = p.nombre.toLowerCase().includes(textoBusqueda);
      const coincideStock = !soloDisponibles || p.stock > 0;
      return coincideCat && coincideNombre && coincideStock;
    }).length;

    btn.textContent = `${cat} (${conteo})`;
  });
}

function crearTarjeta(p) {
  const clon = plantilla.content.cloneNode(true);
  const li = clon.querySelector(".tarjeta");
  const img = clon.querySelector(".tarjeta_foto img");
  const etiqueta = clon.querySelector(".etiqueta");
  const catTxt = clon.querySelector(".tarjeta_categoria");
  const nomTxt = clon.querySelector(".tarjeta_nombre");
  const descTxt = clon.querySelector(".tarjeta_descripcion");
  const precioTxt = clon.querySelector(".tarjeta_precio");
  const porcTxt = clon.querySelector(".tarjeta_porciones");

  li.dataset.id = p.id;
  li.tabIndex = 0;

  img.src = p.imagen;
  img.srcset = `${p.imagen} 1x, ${p.imagen} 2x`;
  img.sizes = "(max-width: 600px) 100vw, 300px";
  img.alt = p.nombre;

  img.addEventListener("load", () => img.classList.add("foto-cargada"));

  if (p.destacado) {
    etiqueta.textContent = "Favorito";
    etiqueta.hidden = false;
  } else if (p.stock === 0) {
    etiqueta.textContent = "Agotado";
    etiqueta.classList.add("etiqueta--agotado");
    etiqueta.hidden = false;
    li.classList.add("tarjeta--agotado");
  }

  catTxt.textContent = p.categoria;
  nomTxt.textContent = p.nombre;
  descTxt.textContent = p.descripcion;
  precioTxt.textContent = formatearSoles(p.precio);
  porcTxt.textContent = p.porciones ? `${p.porciones} porciones` : "1 unidad";

  return clon;
}

function renderizarCatalogo() {
  grilla.setAttribute("aria-busy", "true");

  let lista = productos.filter((p) => {
    const coincideCat = categoriaActiva === TODOS || p.categoria === categoriaActiva;
    const coincideBusqueda = p.nombre.toLowerCase().includes(buscador.value.trim().toLowerCase());
    const coincideStock = !chkDisponibles.checked || p.stock > 0;
    return coincideCat && coincideBusqueda && coincideStock;
  });

  const tipoOrden = ordenSelect.value;
  const copia = lista.slice();

  if (tipoOrden === "precio-asc") {
    copia.sort((a, b) => a.precio - b.precio);
  } else if (tipoOrden === "precio-desc") {
    copia.sort((a, b) => b.precio - a.precio);
  } else if (tipoOrden === "nombre-asc") {
    copia.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  grilla.replaceChildren();

  if (copia.length === 0) {
    estado.textContent = "No hay productos que coincidan con los filtros.";
    grilla.removeAttribute("aria-busy");
    actualizarContadores();
    return;
  }

  const fragmento = document.createDocumentFragment();
  copia.forEach((p) => fragmento.append(crearTarjeta(p)));

  grilla.replaceChildren(fragmento);
  grilla.removeAttribute("aria-busy");

  const filtroTexto = categoriaActiva === TODOS ? "todas las categorías" : `«${categoriaActiva}»`;
  estado.textContent = `Mostrando ${copia.length} productos en ${filtroTexto}.`;

  actualizarContadores();
}

function sincronizarHash() {
  const hash = decodeURIComponent(location.hash.replace("#", "").trim());
  const categorias = obtenerCategorias(productos);

  if (hash && categorias.includes(hash)) {
    categoriaActiva = hash;
  } else {
    categoriaActiva = TODOS;
  }

  actualizarBotonesFiltro();
}

function actualizarBotonesFiltro() {
  const botones = contFiltros.querySelectorAll(".filtro");
  botones.forEach((b) => {
    const activa = b.dataset.categoria === categoriaActiva;
    b.setAttribute("aria-pressed", String(activa));
    b.setAttribute("aria-selected", String(activa));
  });
}

function cambiarCategoria(nuevaCat) {
  categoriaActiva = nuevaCat;
  actualizarBotonesFiltro();

  const nuevoHash = nuevaCat === TODOS ? "" : `#${encodeURIComponent(nuevaCat)}`;
  history.replaceState(null, "", location.pathname + nuevoHash);

  renderizarCatalogo();
}

function abrirModal(idProducto, elementoOrigen) {
  const p = productos.find((item) => item.id === Number(idProducto));
  if (!p) return;

  ultimoElementoFocado = elementoOrigen;

  modalImg.src = p.imagen;
  modalImg.alt = p.nombre;
  modalCategoria.textContent = p.categoria;
  modalNombre.textContent = p.nombre;
  modalDescripcion.textContent = p.descripcion;
  modalPrecio.textContent = formatearSoles(p.precio);
  modalStock.textContent = p.stock > 0 ? `Stock disponible: ${p.stock} unidades` : "Agotado por el momento";

  modal.showModal();
}

function cerrarModal() {
  modal.close();
  if (ultimoElementoFocado) {
    ultimoElementoFocado.focus();
  }
}

contFiltros.addEventListener("click", (e) => {
  const boton = e.target.closest(".filtro");
  if (!boton) return;
  cambiarCategoria(boton.dataset.categoria);
});

buscador.addEventListener("input", () => renderizarCatalogo());
ordenSelect.addEventListener("change", () => renderizarCatalogo());
chkDisponibles.addEventListener("change", () => renderizarCatalogo());

grilla.addEventListener("click", (e) => {
  const tarjeta = e.target.closest(".tarjeta");
  if (tarjeta && tarjeta.dataset.id) {
    abrirModal(tarjeta.dataset.id, tarjeta);
  }
});

grilla.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const tarjeta = e.target.closest(".tarjeta");
    if (tarjeta && tarjeta.dataset.id) {
      abrirModal(tarjeta.dataset.id, tarjeta);
    }
  }
});

btnCerrarModal.addEventListener("click", cerrarModal);
modal.addEventListener("cancel", () => cerrarModal());

async function iniciar() {
  estado.classList.remove("estado--error");
  estado.textContent = "Cargando catálogo de productos...";

  try {
    productos = await cargarProductos();
    const categorias = obtenerCategorias(productos);
    renderizarFiltros(categorias);
    sincronizarHash();
    renderizarCatalogo();
  } catch (error) {
    console.error(error);
    estado.classList.add("estado--error");
    estado.innerHTML = `
      <span>No se pudo cargar el catálogo. Verifique su conexión o Live Server.</span><br>
      <button class="btn-reintentar" onclick="iniciar()">Reintentar</button>
    `;
    grilla.replaceChildren();
    grilla.removeAttribute("aria-busy");
  }
}

window.addEventListener("hashchange", () => {
  sincronizarHash();
  renderizarCatalogo();
});

iniciar();
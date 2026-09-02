const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const state = { volume: 0, capacity: 0, product: 'liquido', tank: 'vertical' };

const toast = m => {
  const t = $('#toast');
  if (!t) return;
  t.textContent = m;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
};

// Mobile Sidebar Drawer Toggle & Backdrop
function toggleSidebar(forceState) {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;
  const shouldOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', shouldOpen);
  if (backdrop) backdrop.classList.toggle('open', shouldOpen);
}

function closeSidebar() {
  toggleSidebar(false);
}

// Navigation Engine
function go(id) {
  if (!id) return;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === id));
  $$('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === id));
  
  const labels = {
    inicio: ['PANEL PRINCIPAL', 'Buen día, operador'],
    dosis: ['ASISTENTE DE DOSIFICACIÓN', 'Nueva dosificación'],
    volumen: ['CÁLCULO DE VOLUMEN', 'Volumen del tanque'],
    verificar: ['VERIFICACIÓN POSTERIOR', 'Verificar residual'],
    calibrar: ['CONTROL DE EQUIPOS', 'Calibrar dosificador'],
    solucion: ['PREPARACIÓN', 'Preparar solución'],
    sistemas: ['REGISTRO', 'Sistemas de agua'],
    historial: ['VIGILANCIA', 'Historial de mediciones'],
    normativa: ['REFERENCIAS TÉCNICAS', 'Normativa y guías']
  };

  if (labels[id]) {
    const lbl = $('#view-label');
    const title = $('#view-title');
    if (lbl) lbl.textContent = labels[id][0];
    if (title) title.textContent = labels[id][1];
  }

  // Close mobile drawer on selection
  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (id === 'inicio') renderDashboardIndicators();
  if (id === 'historial') renderHistory();
  if (id === 'sistemas') renderSystems();
  if (window.gotitaSetPage) window.gotitaSetPage(id);
}

// Global Delegated Event Listener for Navigation, Choices, and Actions
document.addEventListener('click', (e) => {
  // 1. Navigation with data-go
  const goBtn = e.target.closest('[data-go]');
  if (goBtn) {
    e.preventDefault();
    go(goBtn.dataset.go);
    return;
  }

  // 2. Navigation with .nav / data-view
  const navBtn = e.target.closest('.nav');
  if (navBtn && navBtn.dataset.view) {
    e.preventDefault();
    go(navBtn.dataset.view);
    return;
  }

  // 3. Mobile Hamburger Menu Toggle
  const menuBtn = e.target.closest('.menu');
  if (menuBtn) {
    e.preventDefault();
    toggleSidebar();
    return;
  }

  // 4. Mobile Sidebar Close Button or Backdrop Click
  const closeBtn = e.target.closest('#sidebar-close-btn') || e.target.closest('.sidebar-close-btn');
  const backdrop = e.target.closest('#sidebar-backdrop');
  if (closeBtn || backdrop) {
    e.preventDefault();
    closeSidebar();
    return;
  }

  // 5. Product Choice Selection (Hipoclorito de sodio vs calcio)
  const choiceBtn = e.target.closest('.choice');
  if (choiceBtn && choiceBtn.dataset.product) {
    e.preventDefault();
    selectProduct(choiceBtn.dataset.product);
    return;
  }

  // 6. Range preset pills in verification view
  const rangePill = e.target.closest('.range-preset-pill');
  if (rangePill) {
    e.preventDefault();
    const min = rangePill.dataset.min;
    const max = rangePill.dataset.max;
    if (min && max) {
      if ($('#range-min')) $('#range-min').value = min;
      if ($('#range-max')) $('#range-max').value = max;
      $$('.range-preset-pill').forEach(p => p.classList.remove('active'));
      rangePill.classList.add('active');
      toast(`Rango establecido: ${min} – ${max} mg/L`);
    }
    return;
  }
});

// Product Selection Handler with Visual & Field Synchronization
function selectProduct(productType) {
  state.product = productType;
  $$('.choice').forEach(x => {
    const isMatch = x.dataset.product === productType;
    x.classList.toggle('selected', isMatch);
    x.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
  });

  const pres = $('#presentation');
  const conc = $('#concentration');
  if (productType === 'calcio') {
    if (pres) pres.value = 'solid';
    if (conc && (+conc.value === 7.5 || !conc.value)) conc.value = '65';
    if (window.gotitaReact) window.gotitaReact('Seleccionaste Hipoclorito de calcio (sólido ~65%). Recuerda diluirlo antes de verterlo al reservorio ◈🧪');
  } else {
    if (pres) pres.value = 'liquid';
    if (conc && (+conc.value === 65 || !conc.value)) conc.value = '7.5';
    if (window.gotitaReact) window.gotitaReact('Seleccionaste Hipoclorito de sodio (líquido ~7.5%). Excelente para desinfección continua 💧✨');
  }
}

// Synchronize presentation dropdown with choices
const presSelect = $('#presentation');
if (presSelect) {
  presSelect.addEventListener('change', () => {
    if (presSelect.value === 'solid') selectProduct('calcio');
    else selectProduct('liquido');
  });
}

// Multi-step Wizard Navigation
let step = 1;
function setStep(n) {
  step = Math.max(1, Math.min(4, n));
  $$('.step-pane').forEach(p => p.classList.toggle('active', +p.dataset.step === step));
  $$('.steps span').forEach((s, i) => s.classList.toggle('on', i < step));
}

$$('.next').forEach(b => {
  b.onclick = () => {
    if (step === 1 && !+$('#dose-volume').value) {
      return toast('Ingrese el volumen de agua antes de continuar.');
    }
    setStep(step + 1);
  };
});

$$('.back').forEach(b => {
  b.onclick = () => setStep(step - 1);
});

// Dose Calculation
const calcDoseBtn = $('#calculate-dose');
if (calcDoseBtn) {
  calcDoseBtn.onclick = () => {
    const volInput = +$('#dose-volume')?.value || 0;
    const isM3 = $('#dose-unit')?.value === 'm3';
    const vol = volInput * (isM3 ? 1000 : 1);
    const c = +$('#concentration')?.value || 0;
    const now = parseFloat($('#residual-now')?.value || '0');
    const target = parseFloat($('#residual-target')?.value || '0');
    const demand = parseFloat($('#demand')?.value || '0');

    if (!vol || !c || isNaN(now) || !target) {
      return toast('Complete el volumen, la concentración y los residuales.');
    }

    const active = Math.max(0, target - now + demand);
    const grams = (active * vol) / 1000;
    const product = grams / (c / 100);
    const isSolid = state.product === 'calcio';
    const unit = isSolid ? 'g' : 'mL';
    
    let productText = '';
    if (product < 1000) {
      productText = `${product.toLocaleString('es-PE', { maximumFractionDigits: 2 })} ${unit}`;
    } else {
      productText = `${(product / 1000).toLocaleString('es-PE', { maximumFractionDigits: 3 })} ${isSolid ? 'kg' : 'L'}`;
    }

    const resultBox = $('#dose-result');
    if (resultBox) {
      resultBox.innerHTML = `
        <div class="dose-amount">
          <small>DOSIS DE CLORO ACTIVO</small>
          <strong>${active.toFixed(2)} mg/L</strong>
          <small>Incremento requerido: objetivo − actual + demanda</small>
        </div>
        <div class="dose-amount">
          <small>CANTIDAD TEÓRICA DE PRODUCTO</small>
          <strong>${productText}</strong>
          <small>Para ${vol.toLocaleString('es-PE')} L de agua · Producto al ${c}%</small>
        </div>
      `;
    }
    setStep(4);
    if (window.gotitaReact) {
      window.gotitaReact(`¡Dosis calculada: ${active.toFixed(2)} mg/L (${productText})! Recuerda esperar 30 min de contacto 💧⏱️`);
    }
  };
}

// Tank Type & Fields Configuration
const fields = {
  vertical: `
    <div class="input-row">
      <label>Diámetro (m)<input id="diameter" type="number" min="0" step="any" placeholder="Opcional si ingresa radio"></label>
      <label>Radio (m)<input id="radius" type="number" min="0" step="any" placeholder="Opcional si ingresa diámetro"></label>
    </div>
    <div class="input-row">
      <label>Altura total del tanque (m)<input id="total-height" type="number" min="0" step="any" placeholder="Ej. 3.0"></label>
      <label>Altura actual del agua (m)<input id="water-height" type="number" min="0" step="any" placeholder="Ej. 2.4"></label>
    </div>`,
  rectangular: `
    <div class="input-row">
      <label>Largo (m)<input id="length" type="number" min="0" step="any" placeholder="Ej. 5.0"></label>
      <label>Ancho (m)<input id="width" type="number" min="0" step="any" placeholder="Ej. 3.0"></label>
    </div>
    <div class="input-row">
      <label>Altura total (m)<input id="total-height" type="number" min="0" step="any" placeholder="Ej. 2.5"></label>
      <label>Altura actual del agua (m)<input id="water-height" type="number" min="0" step="any" placeholder="Ej. 2.0"></label>
    </div>`,
  cubic: `
    <div class="input-row">
      <label>Lado del cubo (m)<input id="side" type="number" min="0" step="any" placeholder="Ej. 2.0"></label>
      <label>Altura actual del agua (m)<input id="water-height" type="number" min="0" step="any" placeholder="Ej. 1.8"><small>Si está lleno, ingrese el mismo lado.</small></label>
    </div>`,
  horizontal: `
    <div class="input-row">
      <label>Diámetro (m)<input id="diameter" type="number" min="0" step="any" placeholder="Ej. 2.0"></label>
      <label>Longitud (m)<input id="length" type="number" min="0" step="any" placeholder="Ej. 6.0"></label>
    </div>
    <label>Nivel actual del agua (m)<input id="water-height" type="number" min="0" step="any" placeholder="Ej. 1.5"></label>`,
  direct: `
    <div class="input-row">
      <label>Volumen conocido<input id="direct-volume" type="number" min="0" step="any" placeholder="Ej. 15000"></label>
      <label>Unidad
        <select id="direct-unit">
          <option value="l">Litros (L)</option>
          <option value="m3">Metros cúbicos (m³)</option>
        </select>
      </label>
    </div>`
};

const tankMeta = {
  vertical: {
    title: 'Tanque Cilíndrico Vertical (Rotoplas / Polietileno)',
    subtitle: 'Diámetro, altura de pared y nivel efectivo del agua',
    formula: 'V = π × r² × h_agua · (1 m³ = 1,000 Litros)'
  },
  rectangular: {
    title: 'Reservorio Apoyado de Concreto / Cisterna',
    subtitle: 'Largo, ancho, altura total y tirante de agua almacenada',
    formula: 'V = Largo × Ancho × h_agua · (1 m³ = 1,000 Litros)'
  },
  cubic: {
    title: 'Tanque Elevado / Reservorio Cúbico',
    subtitle: 'Lado de la arista interior y nivel del agua',
    formula: 'V = Lado² × h_agua · (1 m³ = 1,000 Litros)'
  },
  horizontal: {
    title: 'Tanque Cilíndrico Horizontal',
    subtitle: 'Diámetro, longitud y nivel del agua por segmento circular',
    formula: 'V = [r² · acos((r-h)/r) - (r-h) · √(2rh - h²)] × Longitud'
  },
  direct: {
    title: 'Ingreso Directo de Volumen Conocido',
    subtitle: 'Aforo hidrométrico, plano hidráulico o medidor de flujo',
    formula: 'V = Volumen directo declarado (m³ o Litros)'
  }
};

function selectTankGeometry(type) {
  const tankSelect = $('#tank-type');
  if (tankSelect) tankSelect.value = type;
  state.tank = type;

  // Update geometry buttons active state
  $$('.tank-geo-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tankType === type);
  });

  // Update titles and subtitles
  const meta = tankMeta[type] || tankMeta.vertical;
  const titleEl = $('#selected-tank-title');
  if (titleEl) titleEl.textContent = meta.title;
  const subEl = $('#selected-tank-subtitle');
  if (subEl) subEl.textContent = meta.subtitle;
  const formulaEl = $('#formula-text');
  if (formulaEl) formulaEl.textContent = meta.formula;

  // Render fields
  const container = $('#tank-fields');
  if (container) container.innerHTML = fields[type] || '';

  // Update 3D visual class
  const visual = $('#tank-visual');
  if (visual) visual.className = `tank-visual ${type}`;
}

function tankFields() {
  const tankSelect = $('#tank-type');
  if (!tankSelect) return;
  selectTankGeometry(tankSelect.value);
}

// Bind geometry selector buttons
$$('.tank-geo-btn').forEach(btn => {
  btn.onclick = () => {
    const tType = btn.dataset.tankType;
    if (tType) selectTankGeometry(tType);
  };
});

const tankTypeEl = $('#tank-type');
if (tankTypeEl) {
  tankTypeEl.onchange = tankFields;
  tankFields();
}

// Calculate Volume
const calcVolBtn = $('#calculate-volume');
if (calcVolBtn) {
  calcVolBtn.onclick = () => {
    const v = id => +$('#' + id)?.value || 0;
    let vol = 0, cap = 0, h = 0, th = 0;

    try {
      if (state.tank === 'vertical') {
        const r = v('radius') || v('diameter') / 2;
        th = v('total-height');
        h = v('water-height');
        if (!r || !th || !h) throw Error();
        cap = Math.PI * r * r * th;
        vol = Math.PI * r * r * h;
      } else if (state.tank === 'rectangular') {
        th = v('total-height');
        h = v('water-height');
        const l = v('length'), w = v('width');
        if (!l || !w || !th || !h) throw Error();
        cap = l * w * th;
        vol = l * w * h;
      } else if (state.tank === 'cubic') {
        const side = v('side');
        h = v('water-height') || side;
        th = side;
        if (!side || !h) throw Error();
        cap = side ** 3;
        vol = side * side * h;
      } else if (state.tank === 'horizontal') {
        const r = v('diameter') / 2;
        const L = v('length');
        h = v('water-height');
        th = 2 * r;
        if (!r || !L || !h) throw Error();
        cap = Math.PI * r * r * L;
        if (h > 0 && h <= 2 * r) {
          const a = r * r * Math.acos((r - h) / r) - (r - h) * Math.sqrt(2 * r * h - h * h);
          vol = a * L;
        }
      } else {
        const directVol = v('direct-volume');
        if (!directVol) throw Error();
        vol = directVol * ($('#direct-unit')?.value === 'm3' ? 1000 : 1);
        cap = vol;
        h = th = 1;
      }

      if (!vol || vol <= 0 || (th > 0 && h > th)) throw Error();
    } catch (e) {
      return toast('Revise las dimensiones: deben ser mayores que cero y físicamente posibles.');
    }

    state.volume = vol * (state.tank === 'direct' ? 1 : 1000);
    state.capacity = cap * (state.tank === 'direct' ? 1 : 1000);
    const pct = Math.min(100, Math.max(0, (state.volume / state.capacity) * 100));

    const waterBar = $('#tank-water-fill') || $('.water');
    if (waterBar) waterBar.style.height = pct + '%';
    
    const pctBadge = $('#volume-percent-badge');
    if (pctBadge) pctBadge.textContent = `${pct.toFixed(0)}% LLENO`;

    const mainVol = $('#volume-main');
    if (mainVol) mainVol.innerHTML = `${state.volume.toLocaleString('es-PE', { maximumFractionDigits: 1 })} <small style="font-size: 18px; color: var(--on-surface-variant);">L</small>`;
    
    const m3Vol = $('#volume-m3');
    if (m3Vol) m3Vol.textContent = (state.volume / 1000).toLocaleString('es-PE', { maximumFractionDigits: 3 });
    
    const capVol = $('#volume-capacity');
    if (capVol) capVol.textContent = state.capacity.toLocaleString('es-PE', { maximumFractionDigits: 1 });
    
    const bordeLibreEl = $('#volume-borde-libre');
    if (bordeLibreEl) {
      if (th > 0 && h > 0) {
        bordeLibreEl.textContent = `${(th - h).toFixed(2)} m (${((1 - pct/100)*100).toFixed(0)}%)`;
      } else {
        bordeLibreEl.textContent = '—';
      }
    }

    const msgVol = $('#volume-message');
    if (msgVol) msgVol.textContent = `Nivel actual: ${pct.toFixed(0)}% de la capacidad total del reservorio.`;
    
    const useVol = $('#use-volume');
    if (useVol) useVol.disabled = false;

    if (window.gotitaReact) {
      window.gotitaReact(`¡Volumen calculado: ${state.volume.toLocaleString('es-PE')} L (${pct.toFixed(0)}% de llenado)! Listo para dosificar 📏💧`);
    }
  };
}

// Transfer Calculated Volume to Dosing Assistant
const useVolBtn = $('#use-volume');
if (useVolBtn) {
  useVolBtn.onclick = () => {
    const doseVolInput = $('#dose-volume');
    const doseUnitSelect = $('#dose-unit');
    if (doseVolInput) doseVolInput.value = state.volume.toFixed(1);
    if (doseUnitSelect) doseUnitSelect.value = 'l';
    go('dosis');
    setStep(2);
    toast('Volumen aplicado. Continúe con el paso 2.');
    if (window.gotitaReact) {
      window.gotitaReact(`¡Volumen de ${state.volume.toLocaleString('es-PE')} L transferido con éxito! Selecciona tu producto 🎯💧`);
    }
  };
}

// Residual Verification Engine
function statusFor(x, min, max) {
  if (x >= min && x <= max) {
    return ['good', '●', 'Dentro del rango', 'Adecuado según el rango de referencia ingresado.'];
  } else if (x < min) {
    return ['warn', '!', 'Requiere verificación', 'El residual está por debajo del rango de referencia.'];
  } else {
    return ['bad', '!', 'Fuera del rango', 'El residual está por encima del rango de referencia.'];
  }
}

const verifyBtn = $('#verify-btn');
if (verifyBtn) {
  verifyBtn.onclick = () => {
    const x = parseFloat($('#verified-residual')?.value || '');
    const min = parseFloat($('#range-min')?.value || '0.5');
    const max = parseFloat($('#range-max')?.value || '1.0');

    if (isNaN(x) || isNaN(min) || isNaN(max) || min > max) {
      return toast('Ingrese una medición y un rango válido.');
    }

    const [c, i, t, p] = statusFor(x, min, max);
    const box = $('#verification-result');
    if (box) {
      box.className = 'verification-card ' + c;
      box.innerHTML = `<span>${i}</span><h3>${t}</h3><p><b>${x.toFixed(2)} mg/L</b> · Rango: ${min}–${max} mg/L</p><p>${p}</p>`;
    }

    const utmZone = $('#sample-utm-zone')?.value || '18S';
    const utmEast = $('#sample-utm-east')?.value ? parseFloat($('#sample-utm-east').value) : null;
    const utmNorth = $('#sample-utm-north')?.value ? parseFloat($('#sample-utm-north').value) : null;

    saveMeasurement({
      value: x,
      min,
      max,
      status: t,
      point: $('#measurement-point')?.value || 'Punto no especificado',
      utmZone,
      utmEast,
      utmNorth,
      date: new Date().toLocaleString('es-PE')
    });
    renderLast();
    toast('Verificación registrada con éxito.');

    if (window.gotitaReact) {
      if (c === 'good') window.gotitaReact(`¡Excelente! Residual de ${x.toFixed(2)} mg/L dentro de norma. Agua 100% segura 🌟💧`);
      else if (c === 'warn') window.gotitaReact(`⚠️ Residual bajo (${x.toFixed(2)} mg/L). Se recomienda revisar dosificador o dosis.`);
      else window.gotitaReact(`🚫 Residual alto (${x.toFixed(2)} mg/L). Ajusta el dosificador para evitar olores y sabores.`);
    }
  };
}

// Sample Clorimeter 1.25 mg/L Auto-load
const loadSampleBtn = $('#load-sample-reading-btn');
if (loadSampleBtn) {
  loadSampleBtn.onclick = () => {
    const resInput = $('#verified-residual');
    if (resInput) {
      resInput.value = '1.25';
      resInput.focus();
    }
    const pointInput = $('#measurement-point');
    if (pointInput && !pointInput.value) {
      pointInput.value = 'Salida de Reservorio Principal R-01';
    }
    // Select range 0.8 - 1.2 or evaluate
    if (verifyBtn) verifyBtn.click();
    toast('Lectura de 1.25 mg/L cargada desde Clorímetro Digital.');
    if (window.gotitaReact) {
      window.gotitaReact('Lectura de 1.25 mg/L cargada. Evaluando conformidad según rango operativo... 🔬💧');
    }
  };
}

// Clorimeter Quote WhatsApp
const quoteClorimetroBtn = $('#clorimetro-quote-wa-btn');
if (quoteClorimetroBtn) {
  quoteClorimetroBtn.onclick = () => {
    const msg = encodeURIComponent('Hola CLORAGUA, solicito cotización e información técnica del CLORÍMETRO DIGITAL PORTÁTIL (Rango 0.00 - 5.00 mg/L, método DPD, compensación automática de temperatura).');
    window.open(`https://wa.me/51920221581?text=${msg}`, '_blank');
  };
}

// Equipment Flow & Calibration
const flowCalcBtn = $('#flow-calc');
if (flowCalcBtn) {
  flowCalcBtn.onclick = () => {
    const q = +$('#flow-water')?.value || 0;
    const d = +$('#flow-dose')?.value || 0;
    const c = +$('#flow-conc')?.value || 0;
    if (!q || !d || !c) return toast('Complete los datos de caudal, dosis y concentración.');
    const mlh = (q * d) / (c * 10);
    const resBox = $('#flow-result');
    if (resBox) {
      resBox.innerHTML = `<b>Caudal requerido:</b><br>${(mlh / 60).toFixed(2)} mL/min · ${mlh.toFixed(2)} mL/h · ${(mlh / 1000).toFixed(3)} L/h`;
    }
    if (window.gotitaReact) window.gotitaReact(`¡Caudal requerido: ${(mlh / 60).toFixed(2)} mL/min! Comprueba con probeta graduada 🧪`);
  };
}

const testCalcBtn = $('#test-calc');
if (testCalcBtn) {
  testCalcBtn.onclick = () => {
    const v = +$('#observed-volume')?.value || 0;
    const t = +$('#observed-time')?.value || 0;
    if (!v || !t) return toast('Ingrese volumen y tiempo de prueba.');
    const realFlow = v / t;
    const resBox = $('#test-result');
    if (resBox) {
      resBox.innerHTML = `<b>Caudal real observado:</b><br>${realFlow.toFixed(2)} mL/min · ${(realFlow * 60).toFixed(2)} mL/h`;
    }
    if (window.gotitaReact) window.gotitaReact(`¡Prueba completada: ${realFlow.toFixed(2)} mL/min! Compara con el caudal requerido ⏱️💧`);
  };
}

// Dilution Calculator
const dilutionBtn = $('#dilution-calc');
if (dilutionBtn) {
  dilutionBtn.onclick = () => {
    const ci = +$('#dilution-initial')?.value || 0;
    const ct = +$('#dilution-target')?.value || 0;
    const v = +$('#dilution-volume')?.value || 0;
    if (!ci || !ct || !v || ct >= ci) {
      return toast('La concentración deseada debe ser menor que la inicial.');
    }
    const prod = (v * ct) / ci;
    const water = v - prod;
    const resBox = $('#dilution-result');
    if (resBox) {
      resBox.innerHTML = `<span>⊕</span><h3>Solución final: ${v.toFixed(2)} L</h3><p>Mezcle <b>${prod.toFixed(3)} L (${(prod * 1000).toFixed(0)} mL)</b> de producto comercial con <b>${water.toFixed(3)} L</b> de agua para obtener una solución al ${ct}%.</p>`;
    }
    if (window.gotitaReact) window.gotitaReact(`¡Solución calculada! Recuerda: vierte siempre el cloro sobre el agua con tu EPP 🦺⚠️`);
  };
}

// Local Storage & History Persistence
const get = k => {
  try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; }
};
const put = (k, x) => {
  try { localStorage.setItem(k, JSON.stringify(x)); } catch (e) {}
};

function saveMeasurement(x) {
  const a = get('cloragua-measurements');
  a.unshift(x);
  put('cloragua-measurements', a);
  renderDashboardIndicators();
}

// ==========================================
// UTM (Universal Transverse Mercator) & WGS84
// ==========================================
function latLonToUtm(lat, lon) {
  const a = 6378137.0; // WGS84 semi-major axis (meters)
  const f = 1.0 / 298.257223563; // Flattening
  const k0 = 0.9996; // Scale factor
  const e = Math.sqrt(2 * f - f * f);
  const ePrimeSq = (e * e) / (1 - e * e);

  const latRad = (lat * Math.PI) / 180.0;
  const lonRad = (lon * Math.PI) / 180.0;

  const zone = Math.floor((lon + 180.0) / 6.0) + 1;
  const lonOrigin = ((zone - 1) * 6 - 180 + 3); // Central meridian
  const lonOriginRad = (lonOrigin * Math.PI) / 180.0;
  const hemisphere = lat >= 0 ? 'N' : 'S';

  const N = a / Math.sqrt(1 - e * e * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = ePrimeSq * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lonRad - lonOriginRad);

  const M = a * ((1 - e * e / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256) * latRad
    - (3 * e * e / 8 + 3 * Math.pow(e, 4) / 32 + 45 * Math.pow(e, 6) / 1024) * Math.sin(2 * latRad)
    + (15 * Math.pow(e, 4) / 256 + 45 * Math.pow(e, 6) / 1024) * Math.sin(4 * latRad)
    - (35 * Math.pow(e, 6) / 3072) * Math.sin(6 * latRad));

  let utmEasting = k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6.0 + (5 - 18 * T + T * T + 72 * C - 58 * ePrimeSq) * Math.pow(A, 5) / 120.0) + 500000.0;
  let utmNorthing = k0 * (M + N * Math.tan(latRad) * (A * A / 2.0 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24.0 + (61 - 58 * T + T * T + 600 * C - 330 * ePrimeSq) * Math.pow(A, 6) / 720.0));

  if (lat < 0) {
    utmNorthing += 10000000.0; // False northing for southern hemisphere
  }

  return {
    zone: `${zone}${hemisphere}`,
    zoneNum: zone,
    hemisphere,
    easting: Math.round(utmEasting * 10) / 10,
    northing: Math.round(utmNorthing * 10) / 10
  };
}

function utmToLatLon(easting, northing, zoneStr) {
  const zoneMatch = String(zoneStr || '18S').match(/^(\d+)\s*([A-Za-z]?)$/);
  const zone = zoneMatch ? parseInt(zoneMatch[1], 10) : 18;
  const isSouth = zoneMatch && zoneMatch[2] ? zoneMatch[2].toUpperCase() === 'S' : true;

  const k0 = 0.9996;
  const a = 6378137.0;
  const f = 1.0 / 298.257223563;
  const e = Math.sqrt(2 * f - f * f);
  const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));

  const x = easting - 500000.0;
  let y = northing;
  if (isSouth) y -= 10000000.0;

  const M = y / k0;
  const mu = M / (a * (1 - e * e / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));

  const phi1Rad = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
    + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu);

  const ePrimeSq = (e * e) / (1 - e * e);
  const N1 = a / Math.sqrt(1 - e * e * Math.sin(phi1Rad) * Math.sin(phi1Rad));
  const T1 = Math.tan(phi1Rad) * Math.tan(phi1Rad);
  const C1 = ePrimeSq * Math.cos(phi1Rad) * Math.cos(phi1Rad);
  const R1 = a * (1 - e * e) / Math.pow(1 - e * e * Math.sin(phi1Rad) * Math.sin(phi1Rad), 1.5);
  const D = x / (N1 * k0);

  let lat = phi1Rad - (N1 * Math.tan(phi1Rad) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ePrimeSq) * Math.pow(D, 4) / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ePrimeSq - 3 * C1 * C1) * Math.pow(D, 6) / 720);
  lat = (lat * 180.0) / Math.PI;

  let lon = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ePrimeSq + 24 * T1 * T1) * Math.pow(D, 5) / 120) / Math.cos(phi1Rad);
  lon = ((zone - 1) * 6 - 180 + 3) + (lon * 180.0) / Math.PI;

  return { lat, lon };
}

// ==========================================================================
// GOOGLE MAPS PARSER, UTM CONVERTER & INTERACTIVE SATELLITE MAP PICKER
// ==========================================================================

// Parse Lat/Lon from any Google Maps text, link, DMS string or coordinate pair
function parseCoordinatesFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();
  if (!text) return null;

  // 1. Check Google Maps URLs with @lat,lon (e.g. /@ -12.04637,-77.04279,17z)
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]), source: 'Enlace de Google Maps' };
  }

  // 2. Check query params (q=, query=, ll=, daddr=, destination=, etc.)
  const qMatch = text.match(/[?&](?:q|query|ll|daddr|saddr|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/i);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lon: parseFloat(qMatch[2]), source: 'Parámetro Google Maps' };
  }

  // 3. Check geo: URI (geo:-12.04637,-77.04279)
  const geoMatch = text.match(/geo:(-?\d+\.\d+),(-?\d+\.\d+)/i);
  if (geoMatch) {
    return { lat: parseFloat(geoMatch[1]), lon: parseFloat(geoMatch[2]), source: 'URI Geográfica' };
  }

  // 4. Check DMS format (Grados, Minutos, Segundos: ej. 13°09'31.6"S 74°13'23.6"W)
  const dmsRegex = /(\d+)[°º\s]+(\d+)['\'\s]+([\d\.]+)["]?\s*([NSEWnsew])[\s,]+(\d+)[°º\s]+(\d+)['\'\s]+([\d\.]+)["]?\s*([NSEWnsew])/;
  const dmsMatch = text.match(dmsRegex);
  if (dmsMatch) {
    let lat = parseInt(dmsMatch[1], 10) + parseInt(dmsMatch[2], 10) / 60 + parseFloat(dmsMatch[3]) / 3600;
    if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;
    let lon = parseInt(dmsMatch[5], 10) + parseInt(dmsMatch[6], 10) / 60 + parseFloat(dmsMatch[7]) / 3600;
    if (dmsMatch[8].toUpperCase() === 'W' || dmsMatch[8].toUpperCase() === 'O') lon = -lon;
    return { lat, lon, source: 'Coordenadas DMS (Grados/Minutos/Segundos)' };
  }

  // 5. Check directional decimal: 12.04637 S, 77.04279 W
  const dirMatch = text.match(/(\d+\.\d+)\s*([NSEWnsew])[,\s]+(\d+\.\d+)\s*([NSEWnsew])/);
  if (dirMatch) {
    let lat = parseFloat(dirMatch[1]);
    if (dirMatch[2].toUpperCase() === 'S') lat = -lat;
    let lon = parseFloat(dirMatch[3]);
    if (dirMatch[4].toUpperCase() === 'W' || dirMatch[4].toUpperCase() === 'O') lon = -lon;
    return { lat, lon, source: 'Decimal con Cardinal' };
  }

  // 6. Check standard decimal pair: -12.046374, -77.042793 or -12.046374 -77.042793
  const pairMatch = text.match(/(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);
  if (pairMatch) {
    const lat = parseFloat(pairMatch[1]);
    const lon = parseFloat(pairMatch[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat, lon, source: 'Coordenadas Decimales' };
    }
  }

  return null;
}

// Interactive Map Picker Controller (Leaflet Map)
let leafletMap = null;
let leafletMarker = null;
let currentMapTarget = 'system'; // 'system' or 'sample'
let currentMapCoords = { lat: -13.15878, lon: -74.22321, utm: null };
let currentMapTileLayer = null;

const mapLayers = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  streets: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  topo: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
};

function updateMapHud(lat, lon) {
  const utm = latLonToUtm(lat, lon);
  currentMapCoords = { lat, lon, utm };

  const latLonEl = $('#hud-latlon-val');
  const zoneEl = $('#hud-utmzone-val');
  const eastEl = $('#hud-utmeast-val');
  const northEl = $('#hud-utmnorth-val');
  const gmapsLink = $('#hud-gmaps-external-link');

  if (latLonEl) latLonEl.textContent = `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
  if (zoneEl) zoneEl.textContent = utm.zone;
  if (eastEl) eastEl.textContent = `${utm.easting.toLocaleString('es-PE')} m`;
  if (northEl) northEl.textContent = `${utm.northing.toLocaleString('es-PE')} m`;
  if (gmapsLink) gmapsLink.href = `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
}

function initOrUpdateLeafletMap(initialLat, initialLon) {
  const mapContainer = $('#interactive-leaflet-map');
  if (!mapContainer || typeof L === 'undefined') return;

  const lat = initialLat || currentMapCoords.lat || -13.15878;
  const lon = initialLon || currentMapCoords.lon || -74.22321;

  if (!leafletMap) {
    leafletMap = L.map('interactive-leaflet-map', {
      center: [lat, lon],
      zoom: 14,
      zoomControl: true
    });

    currentMapTileLayer = L.tileLayer(mapLayers.satellite, {
      maxZoom: 19,
      attribution: 'Esri Satellite & Imagery'
    }).addTo(leafletMap);

    // Create marker
    const customIcon = L.divIcon({
      className: 'custom-map-marker-pin',
      html: '<div style="background: #00696b; color: #fff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.35); border: 2.5px solid #fff; font-size: 18px;">📍</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 34]
    });

    leafletMarker = L.marker([lat, lon], {
      draggable: true,
      icon: customIcon
    }).addTo(leafletMap);

    leafletMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      updateMapHud(pos.lat, pos.lng);
    });

    leafletMap.on('click', (e) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      leafletMarker.setLatLng([clickLat, clickLng]);
      updateMapHud(clickLat, clickLng);
    });
  } else {
    leafletMap.setView([lat, lon], 14);
    if (leafletMarker) leafletMarker.setLatLng([lat, lon]);
  }

  updateMapHud(lat, lon);
  setTimeout(() => {
    if (leafletMap) leafletMap.invalidateSize();
  }, 250);
}

function openMapPicker(targetType, initialLat, initialLon) {
  currentMapTarget = targetType || 'system';
  const modal = $('#map-picker-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  // If system has coordinates already in form, center on them
  let startLat = initialLat;
  let startLon = initialLon;

  if (!startLat) {
    const eastVal = currentMapTarget === 'system' ? $('#sys-utm-east')?.value : $('#sample-utm-east')?.value;
    const northVal = currentMapTarget === 'system' ? $('#sys-utm-north')?.value : $('#sample-utm-north')?.value;
    const zoneVal = currentMapTarget === 'system' ? $('#sys-utm-zone')?.value : $('#sample-utm-zone')?.value;

    if (eastVal && northVal) {
      try {
        const converted = utmToLatLon(parseFloat(eastVal), parseFloat(northVal), zoneVal || '18S');
        startLat = converted.lat;
        startLon = converted.lon;
      } catch (e) {}
    }
  }

  initOrUpdateLeafletMap(startLat, startLon);
}

function closeMapPicker() {
  const modal = $('#map-picker-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
}

// GPS / UTM Geolocation & Google Maps Extractor Setup
function setupGeolocationHandlers() {
  // 1. Google Maps Extractor for Systems
  const sysExtractBtn = $('#sys-gmaps-extract-btn');
  const sysGmapsInput = $('#sys-gmaps-input');
  const sysPasteBtn = $('#sys-gmaps-paste-btn');
  const sysMyLocBtn = $('#sys-gmaps-my-loc-btn');
  const gmapsHelpToggle = $('#gmaps-help-toggle-btn');
  const gmapsHelpPanel = $('#gmaps-help-panel');

  if (gmapsHelpToggle && gmapsHelpPanel) {
    gmapsHelpToggle.onclick = () => {
      gmapsHelpPanel.classList.toggle('hidden');
    };
  }

  const handleSysGmapsExtraction = () => {
    const raw = sysGmapsInput?.value || '';
    if (!raw.trim()) {
      return toast('Pegue un enlace o coordenadas de Google Maps primero.');
    }
    const coords = parseCoordinatesFromText(raw);
    if (!coords) {
      return toast('No se reconocieron coordenadas válidas. Verifique el texto o enlace copiado.');
    }

    const utm = latLonToUtm(coords.lat, coords.lon);
    if ($('#sys-utm-zone')) $('#sys-utm-zone').value = utm.zone;
    if ($('#sys-utm-east')) $('#sys-utm-east').value = utm.easting;
    if ($('#sys-utm-north')) $('#sys-utm-north').value = utm.northing;

    const statusEl = $('#utm-geo-status');
    if (statusEl) {
      statusEl.innerHTML = `✅ Coordenadas extraídas desde Google Maps (${coords.source}): <b>Lat: ${coords.lat.toFixed(5)}°, Lon: ${coords.lon.toFixed(5)}°</b> → UTM Zona ${utm.zone}`;
    }
    toast(`¡Coordenadas UTM calculadas con éxito! Zona ${utm.zone} | E: ${utm.easting} | N: ${utm.northing}`);
    if (window.gotitaReact) window.gotitaReact(`¡Listo! Coordenadas de Google Maps convertidas a UTM Zona ${utm.zone}: Este ${utm.easting}, Norte ${utm.northing} 🗺️📍✨`);
  };

  if (sysExtractBtn) sysExtractBtn.onclick = handleSysGmapsExtraction;
  if (sysGmapsInput) {
    sysGmapsInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSysGmapsExtraction();
      }
    };
  }

  if (sysMyLocBtn) {
    sysMyLocBtn.onclick = () => {
      if (!navigator.geolocation) return toast('Geolocalización no soportada en su navegador.');
      sysMyLocBtn.disabled = true;
      sysMyLocBtn.innerHTML = '<span class="material-symbols-outlined spin" style="font-size: 16px;">sync</span> Ubicando...';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sysMyLocBtn.disabled = false;
          sysMyLocBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; color: #ea4335;">my_location</span> Mi Ubicación';
          const { latitude, longitude } = pos.coords;
          if (sysGmapsInput) sysGmapsInput.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          handleSysGmapsExtraction();
        },
        (err) => {
          sysMyLocBtn.disabled = false;
          sysMyLocBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; color: #ea4335;">my_location</span> Mi Ubicación';
          toast('No se pudo obtener la ubicación GPS: ' + (err.message || 'Permiso denegado'));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };
  }

  if (sysPasteBtn) {
    sysPasteBtn.onclick = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && sysGmapsInput) {
            sysGmapsInput.value = text;
            handleSysGmapsExtraction();
            return;
          }
        }
      } catch (err) {}
      const manual = prompt('Pegue aquí el enlace o coordenadas de Google Maps:');
      if (manual && sysGmapsInput) {
        sysGmapsInput.value = manual;
        handleSysGmapsExtraction();
      }
    };
  }

  // 2. Google Maps Extractor for Sample Verification
  const sampleExtractBtn = $('#sample-gmaps-extract-btn');
  const sampleGmapsInput = $('#sample-gmaps-input');
  if (sampleExtractBtn && sampleGmapsInput) {
    sampleExtractBtn.onclick = () => {
      const raw = sampleGmapsInput.value || '';
      if (!raw.trim()) return toast('Pegue un enlace o coordenadas de Google Maps.');
      const coords = parseCoordinatesFromText(raw);
      if (!coords) return toast('Formato de coordenadas no reconocido.');

      const utm = latLonToUtm(coords.lat, coords.lon);
      if ($('#sample-utm-zone')) $('#sample-utm-zone').value = utm.zone;
      if ($('#sample-utm-east')) $('#sample-utm-east').value = utm.easting;
      if ($('#sample-utm-north')) $('#sample-utm-north').value = utm.northing;
      toast(`UTM fijadas: Zona ${utm.zone} | E: ${utm.easting} | N: ${utm.northing}`);
    };
  }

  // 3. Open Map Picker Buttons
  const openSysMapBtn = $('#open-map-picker-btn');
  if (openSysMapBtn) openSysMapBtn.onclick = () => openMapPicker('system');

  const openSampleMapBtn = $('#open-sample-map-btn');
  if (openSampleMapBtn) openSampleMapBtn.onclick = () => openMapPicker('sample');

  // ==========================================================================
  // 3.1 1-CLIC GOOGLE MAPS LAUNCHER & ASSISTANT MODAL
  // ==========================================================================
  let currentAssistantTarget = 'system';
  let assistantCalculatedUtm = null;

  function getGmapsSearchUrl(target) {
    if (target === 'system') {
      const town = ($('#sys-town')?.value || '').trim();
      const district = ($('#sys-district')?.value || '').trim();
      const province = ($('#sys-province')?.value || '').trim();
      const dept = ($('#sys-department')?.value || '').trim();
      const name = ($('#sys-name')?.value || '').trim();

      const queryParts = [town, district, province, dept].filter(Boolean);
      if (queryParts.length > 0) {
        return {
          url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParts.join(', ') + ', Peru')}`,
          label: `Abrir Google Maps en ${queryParts.slice(0, 2).join(', ')} ↗`
        };
      }
      if (name) {
        return {
          url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ', Peru')}`,
          label: `Buscar "${name}" en Google Maps ↗`
        };
      }
    } else {
      const point = ($('#measurement-point')?.value || '').trim();
      if (point) {
        return {
          url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point + ', Peru')}`,
          label: `Buscar "${point}" en Google Maps ↗`
        };
      }
    }

    return {
      url: 'https://www.google.com/maps/@-9.189967,-75.015152,6z',
      label: 'Abrir Google Maps Oficial (Perú) ↗'
    };
  }

  function openGmapsAssistant(target) {
    currentAssistantTarget = target || 'system';
    assistantCalculatedUtm = null;

    const modal = $('#gmaps-assistant-modal');
    const { url, label } = getGmapsSearchUrl(currentAssistantTarget);

    const btnText = $('#assistant-gmaps-btn-text');
    if (btnText) btnText.textContent = label;

    const input = $('#assistant-input-gmaps');
    if (input) input.value = '';

    const resBox = $('#assistant-utm-result-box');
    if (resBox) resBox.classList.add('hidden');

    const applyBtn = $('#assistant-apply-btn');
    if (applyBtn) applyBtn.disabled = true;

    if (modal) {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }

    // Launch Google Maps in new tab
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {}

    toast('Google Maps abierto en nueva pestaña. Copia las coordenadas de tu reservorio.');
  }

  function closeGmapsAssistant() {
    const modal = $('#gmaps-assistant-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  const launchSysGmapsBtn = $('#launch-gmaps-direct-btn');
  if (launchSysGmapsBtn) {
    launchSysGmapsBtn.onclick = () => openGmapsAssistant('system');
  }

  const launchSampleGmapsBtn = $('#launch-gmaps-sample-btn');
  if (launchSampleGmapsBtn) {
    launchSampleGmapsBtn.onclick = () => openGmapsAssistant('sample');
  }

  // Launch Google Maps with Current GPS Position
  const assistantLaunchGpsBtn = $('#assistant-launch-gps-btn');
  if (assistantLaunchGpsBtn) {
    assistantLaunchGpsBtn.onclick = () => {
      if (!navigator.geolocation) return toast('Geolocalización no soportada en este navegador.');
      assistantLaunchGpsBtn.disabled = true;
      assistantLaunchGpsBtn.innerHTML = '<span class="material-symbols-outlined spin" style="font-size: 20px;">sync</span> <span><b>Detectando GPS...</b></span>';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          assistantLaunchGpsBtn.disabled = false;
          assistantLaunchGpsBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 20px;">my_location</span> <span><b>1. Abrir en Mi Ubicación Actual</b></span>';
          const { latitude, longitude } = pos.coords;
          const gmapsUrl = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}&z=18`;

          // Open Google Maps in new tab centered on user
          window.open(gmapsUrl, '_blank', 'noopener,noreferrer');

          // Auto-fill assistant input and calculate UTM
          const input = $('#assistant-input-gmaps');
          if (input) input.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          handleAssistantTransform();

          toast(`Google Maps abierto en tu ubicación actual (${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°). ¡Coordenadas UTM calculadas!`);
          if (window.gotitaReact) window.gotitaReact(`¡Ubicación actual detectada y abierta en Google Maps! Coordenadas transformadas a UTM WGS84 🛰️📍🎯`);
        },
        (err) => {
          assistantLaunchGpsBtn.disabled = false;
          assistantLaunchGpsBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 20px;">my_location</span> <span><b>1. Abrir en Mi Ubicación Actual</b></span>';
          toast('No se pudo obtener el GPS: ' + (err.message || 'Permiso denegado'));
          // Fallback: open default maps
          window.open('https://www.google.com/maps/@-9.189967,-75.015152,6z', '_blank', 'noopener,noreferrer');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };
  }

  const assistantLaunchBtn = $('#assistant-launch-gmaps-link');
  if (assistantLaunchBtn) {
    assistantLaunchBtn.onclick = () => {
      const { url } = getGmapsSearchUrl(currentAssistantTarget);
      window.open(url, '_blank', 'noopener,noreferrer');
      toast('Abriendo Google Maps...');
    };
  }

  const assistantCloseX = $('#gmaps-assistant-close-x');
  const assistantCancel = $('#assistant-cancel-btn');
  if (assistantCloseX) assistantCloseX.onclick = closeGmapsAssistant;
  if (assistantCancel) assistantCancel.onclick = closeGmapsAssistant;

  const handleAssistantTransform = () => {
    const raw = ($('#assistant-input-gmaps')?.value || '').trim();
    if (!raw) return toast('Pegue un enlace o coordenadas de Google Maps primero.');

    const coords = parseCoordinatesFromText(raw);
    if (!coords) {
      return toast('Formato de coordenadas no reconocido. Copie los números (ej. -13.1587, -74.2239) o el enlace de Google Maps.');
    }

    const utm = latLonToUtm(coords.lat, coords.lon);
    assistantCalculatedUtm = { coords, utm };

    if ($('#assistant-latlon-txt')) $('#assistant-latlon-txt').textContent = `${coords.lat.toFixed(5)}°, ${coords.lon.toFixed(5)}°`;
    if ($('#assistant-zone-txt')) $('#assistant-zone-txt').textContent = utm.zone;
    if ($('#assistant-east-txt')) $('#assistant-east-txt').textContent = `${utm.easting.toLocaleString('es-PE')} m`;
    if ($('#assistant-north-txt')) $('#assistant-north-txt').textContent = `${utm.northing.toLocaleString('es-PE')} m`;
    if ($('#assistant-source-tag')) $('#assistant-source-tag').textContent = coords.source;

    const resBox = $('#assistant-utm-result-box');
    if (resBox) resBox.classList.remove('hidden');

    const applyBtn = $('#assistant-apply-btn');
    if (applyBtn) applyBtn.disabled = false;

    toast(`¡Coordenadas calculadas! Zona ${utm.zone} | E: ${utm.easting} | N: ${utm.northing}`);
  };

  const assistantConvertBtn = $('#assistant-convert-btn');
  if (assistantConvertBtn) assistantConvertBtn.onclick = handleAssistantTransform;

  const assistantInput = $('#assistant-input-gmaps');
  if (assistantInput) {
    assistantInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAssistantTransform();
      }
    };
  }

  const assistantPasteBtn = $('#assistant-paste-btn');
  if (assistantPasteBtn) {
    assistantPasteBtn.onclick = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && assistantInput) {
            assistantInput.value = text;
            handleAssistantTransform();
            return;
          }
        }
      } catch (e) {}
      const manual = prompt('Pegue aquí el enlace o coordenadas copiadas de Google Maps:');
      if (manual && assistantInput) {
        assistantInput.value = manual;
        handleAssistantTransform();
      }
    };
  }

  const assistantApplyBtn = $('#assistant-apply-btn');
  if (assistantApplyBtn) {
    assistantApplyBtn.onclick = () => {
      if (!assistantCalculatedUtm) return;
      const { coords, utm } = assistantCalculatedUtm;

      if (currentAssistantTarget === 'system') {
        if ($('#sys-utm-zone')) $('#sys-utm-zone').value = utm.zone;
        if ($('#sys-utm-east')) $('#sys-utm-east').value = utm.easting;
        if ($('#sys-utm-north')) $('#sys-utm-north').value = utm.northing;
        const statusEl = $('#utm-geo-status');
        if (statusEl) {
          statusEl.innerHTML = `✅ Coordenadas extraídas desde Google Maps: <b>Lat: ${coords.lat.toFixed(5)}°, Lon: ${coords.lon.toFixed(5)}°</b> → UTM Zona ${utm.zone}`;
        }
      } else {
        if ($('#sample-utm-zone')) $('#sample-utm-zone').value = utm.zone;
        if ($('#sample-utm-east')) $('#sample-utm-east').value = utm.easting;
        if ($('#sample-utm-north')) $('#sample-utm-north').value = utm.northing;
      }

      closeGmapsAssistant();
      toast(`Coordenadas UTM aplicadas: Zona ${utm.zone} | E: ${utm.easting} | N: ${utm.northing}`);
      if (window.gotitaReact) window.gotitaReact(`¡Coordenadas de Google Maps transformadas y aplicadas a UTM con éxito! 🌐📍🎯`);
    };
  }

  // Auto-focus helper: When user returns from Google Maps tab
  window.addEventListener('focus', async () => {
    const modal = $('#gmaps-assistant-modal');
    if (modal && !modal.classList.contains('hidden') && assistantInput && !assistantInput.value) {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && parseCoordinatesFromText(text)) {
            assistantInput.value = text;
            handleAssistantTransform();
          }
        }
      } catch (e) {}
    }
  });

  // Modal Close & Apply Handlers
  const modalCloseX = $('#map-modal-close-x');
  const modalCancel = $('#map-modal-cancel-btn');
  const modalBackdrop = $('#map-picker-modal');
  const modalApply = $('#map-modal-apply-btn');

  if (modalCloseX) modalCloseX.onclick = closeMapPicker;
  if (modalCancel) modalCancel.onclick = closeMapPicker;
  if (modalBackdrop) {
    modalBackdrop.onclick = (e) => {
      if (e.target === modalBackdrop) closeMapPicker();
    };
  }

  if (modalApply) {
    modalApply.onclick = () => {
      const { lat, lon, utm } = currentMapCoords;
      if (!utm) return closeMapPicker();

      if (currentMapTarget === 'system') {
        if ($('#sys-utm-zone')) $('#sys-utm-zone').value = utm.zone;
        if ($('#sys-utm-east')) $('#sys-utm-east').value = utm.easting;
        if ($('#sys-utm-north')) $('#sys-utm-north').value = utm.northing;
        const statusEl = $('#utm-geo-status');
        if (statusEl) {
          statusEl.innerHTML = `✅ Coordenadas seleccionadas en mapa: <b>Lat: ${lat.toFixed(5)}°, Lon: ${lon.toFixed(5)}°</b> → UTM Zona ${utm.zone}`;
        }
      } else {
        if ($('#sample-utm-zone')) $('#sample-utm-zone').value = utm.zone;
        if ($('#sample-utm-east')) $('#sample-utm-east').value = utm.easting;
        if ($('#sample-utm-north')) $('#sample-utm-north').value = utm.northing;
      }

      closeMapPicker();
      toast(`Coordenadas UTM aplicadas: Zona ${utm.zone} | E: ${utm.easting} | N: ${utm.northing}`);
      if (window.gotitaReact) window.gotitaReact(`¡Coordenadas del mapa satelital aplicadas con éxito al formulario! 🛰️📍🎯`);
    };
  }

  // Layer buttons inside map modal
  const layerSat = $('#map-layer-satellite');
  const layerStreets = $('#map-layer-streets');
  const layerTopo = $('#map-layer-topo');
  const layerBtns = [layerSat, layerStreets, layerTopo].filter(Boolean);

  const switchLayer = (url, activeBtn) => {
    if (!leafletMap) return;
    if (currentMapTileLayer) leafletMap.removeLayer(currentMapTileLayer);
    currentMapTileLayer = L.tileLayer(url, { maxZoom: 19 }).addTo(leafletMap);
    layerBtns.forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
  };

  if (layerSat) layerSat.onclick = () => switchLayer(mapLayers.satellite, layerSat);
  if (layerStreets) layerStreets.onclick = () => switchLayer(mapLayers.streets, layerStreets);
  if (layerTopo) layerTopo.onclick = () => switchLayer(mapLayers.topo, layerTopo);

  // Search in Map via Nominatim
  const searchInput = $('#map-search-input');
  const searchBtn = $('#map-search-btn');

  const performMapSearch = async () => {
    const q = (searchInput?.value || '').trim();
    if (!q) return toast('Escriba el nombre de una ciudad, distrito o lugar.');
    searchBtn.disabled = true;
    searchBtn.textContent = 'Buscando...';

    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ', Peru')}&limit=1`);
      const data = await resp.json();
      searchBtn.disabled = false;
      searchBtn.textContent = 'Buscar';

      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        if (leafletMap) {
          leafletMap.setView([lat, lon], 15);
          if (leafletMarker) leafletMarker.setLatLng([lat, lon]);
          updateMapHud(lat, lon);
          toast(`Lugar encontrado: ${result.display_name.split(',')[0]}`);
        }
      } else {
        toast('No se encontró el lugar. Intente con el nombre del distrito o provincia.');
      }
    } catch (e) {
      searchBtn.disabled = false;
      searchBtn.textContent = 'Buscar';
      toast('Error al buscar en el mapa. Verifique su conexión.');
    }
  };

  if (searchBtn) searchBtn.onclick = performMapSearch;
  if (searchInput) {
    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performMapSearch();
      }
    };
  }

  // Quick Map Center Tags & Geolocation
  const handleMapLocateMe = (triggerBtn) => {
    if (!navigator.geolocation) return toast('Geolocalización no soportada.');
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.innerHTML = '<span class="material-symbols-outlined spin" style="font-size: 16px;">sync</span> Localizando GPS...';
    }
    toast('Detectando ubicación GPS para el mapa satelital...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (triggerBtn) {
          triggerBtn.disabled = false;
          triggerBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; color: #ea4335;">my_location</span> <strong>Mi Ubicación GPS</strong>';
        }
        const { latitude, longitude } = pos.coords;
        if (leafletMap) {
          leafletMap.setView([latitude, longitude], 17);
          if (leafletMarker) leafletMarker.setLatLng([latitude, longitude]);
          updateMapHud(latitude, longitude);
          toast(`¡Mapa centrado en tu ubicación GPS actual! (${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°)`);
        }
      },
      (err) => {
        if (triggerBtn) {
          triggerBtn.disabled = false;
          triggerBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; color: #ea4335;">my_location</span> <strong>Mi Ubicación GPS</strong>';
        }
        toast('No se pudo obtener el GPS: ' + (err.message || 'Permiso denegado'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const mapLocateMeBtn = $('#map-locate-me-btn');
  if (mapLocateMeBtn) mapLocateMeBtn.onclick = () => handleMapLocateMe(mapLocateMeBtn);

  const mapTagMyLoc = $('#map-tag-my-loc');
  if (mapTagMyLoc) mapTagMyLoc.onclick = () => handleMapLocateMe(null);

  // Quick Map Center Tags
  $$('.map-tag-btn').forEach(btn => {
    if (btn.id === 'map-tag-my-loc') return;
    btn.onclick = () => {
      const lat = parseFloat(btn.dataset.lat);
      const lon = parseFloat(btn.dataset.lon);
      const zoom = parseInt(btn.dataset.zoom, 10) || 14;
      if (leafletMap) {
        leafletMap.setView([lat, lon], zoom);
        if (leafletMarker) leafletMarker.setLatLng([lat, lon]);
        updateMapHud(lat, lon);
      }
    };
  });

  // 4. GPS Button for Systems
  const geoSysBtn = $('#geo-btn-system');
  if (geoSysBtn) {
    geoSysBtn.onclick = () => {
      if (!navigator.geolocation) {
        return toast('La geolocalización no es compatible con este dispositivo.');
      }
      geoSysBtn.disabled = true;
      geoSysBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; animation: spin 1s infinite linear;">sync</span> Obteniendo GPS...';
      const statusEl = $('#utm-geo-status');
      if (statusEl) statusEl.textContent = 'Buscando satélites GPS para fijar coordenadas de alta precisión...';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          geoSysBtn.disabled = false;
          geoSysBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">my_location</span> GPS Actual';
          const { latitude, longitude, altitude, accuracy } = pos.coords;
          const utm = latLonToUtm(latitude, longitude);

          if ($('#sys-utm-zone')) $('#sys-utm-zone').value = utm.zone;
          if ($('#sys-utm-east')) $('#sys-utm-east').value = utm.easting;
          if ($('#sys-utm-north')) $('#sys-utm-north').value = utm.northing;
          if ($('#sys-utm-alt') && altitude) $('#sys-utm-alt').value = Math.round(altitude);

          if (statusEl) {
            statusEl.innerHTML = `✅ Coordenadas capturadas con éxito (Precisión GPS: ±${accuracy.toFixed(1)} m) · <b>Lat: ${latitude.toFixed(5)}°, Lon: ${longitude.toFixed(5)}°</b>`;
          }
          toast(`Coordenadas UTM fijadas: Zona ${utm.zone} | E: ${utm.easting} | N: ${utm.northing}`);
          if (window.gotitaReact) window.gotitaReact(`¡Ubicación GPS capturada! Coordenadas UTM Zona ${utm.zone}: Este ${utm.easting}, Norte ${utm.northing} 📍🛰️`);
        },
        (err) => {
          geoSysBtn.disabled = false;
          geoSysBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">my_location</span> GPS Actual';
          if (statusEl) statusEl.textContent = 'No se pudo acceder al sensor GPS. Puede ingresar las coordenadas UTM o pegarlas desde Google Maps.';
          toast('No se pudo obtener el GPS: ' + (err.message || 'Permiso denegado'));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };
  }

  // 5. GPS Button for Sample
  const geoSampleBtn = $('#geo-btn-sample');
  if (geoSampleBtn) {
    geoSampleBtn.onclick = () => {
      if (!navigator.geolocation) return toast('Geolocalización no soportada.');
      geoSampleBtn.disabled = true;
      geoSampleBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px; animation: spin 1s infinite linear;">sync</span>...';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          geoSampleBtn.disabled = false;
          geoSampleBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">my_location</span> GPS actual';
          const { latitude, longitude } = pos.coords;
          const utm = latLonToUtm(latitude, longitude);

          if ($('#sample-utm-zone')) $('#sample-utm-zone').value = utm.zone;
          if ($('#sample-utm-east')) $('#sample-utm-east').value = utm.easting;
          if ($('#sample-utm-north')) $('#sample-utm-north').value = utm.northing;
          toast(`UTM de muestreo: E ${utm.easting}, N ${utm.northing}`);
        },
        (err) => {
          geoSampleBtn.disabled = false;
          geoSampleBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">my_location</span> GPS actual';
          toast('GPS no disponible.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };
  }
}
setupGeolocationHandlers();

function renderHistory() {
  const searchInput = $('#history-search');
  const stateSelect = $('#history-state');
  const list = $('#history-list');
  if (!list) return;

  const q = (searchInput?.value || '').toLowerCase();
  const f = stateSelect?.value || '';
  const all = get('cloragua-measurements');
  const filtered = all.filter(x => (!f || x.status === f) && (`${x.point} ${x.status} ${x.utmEast || ''} ${x.utmNorth || ''}`).toLowerCase().includes(q));

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state" style="padding: 24px; text-align: center; color: var(--on-surface-variant);">No hay mediciones que coincidan con los filtros.</div>`;
    return;
  }

  list.innerHTML = filtered.map(x => {
    let utmHtml = '';
    if (x.utmEast && x.utmNorth) {
      utmHtml = `<div class="utm-pill-badge" style="margin-top: 4px; font-size: 11px;"><span class="material-symbols-outlined" style="font-size: 13px;">pin_drop</span> UTM ${x.utmZone || '18S'}: E ${Number(x.utmEast).toLocaleString('es-PE')} · N ${Number(x.utmNorth).toLocaleString('es-PE')}</div>`;
    }
    return `
      <article class="history-item">
        <div>
          <h3>${x.value.toFixed(2)} mg/L · ${x.point}</h3>
          <p>${x.date} · Rango: ${x.min}–${x.max} mg/L</p>
          ${utmHtml}
        </div>
        <span class="pill ${x.status === 'Dentro del rango' ? 'good' : x.status === 'Fuera del rango' ? 'bad' : 'warn'}">${x.status}</span>
      </article>
    `;
  }).join('');
}

const historySearch = $('#history-search');
if (historySearch) historySearch.oninput = renderHistory;
const historyState = $('#history-state');
if (historyState) historyState.onchange = renderHistory;

function renderDashboardIndicators() {
  // 1. Live Time Update
  const clockEl = $('#dashboard-live-clock');
  if (clockEl) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });
    clockEl.innerHTML = `<span class="material-symbols-outlined" style="font-size: 15px; color: var(--secondary);">schedule</span> ${dateStr}, ${timeStr} • Telemetría activa`;
  }

  // 2. Measurements & Compliance Indicators
  const measurements = get('cloragua-measurements');
  const compVal = $('#kpi-compliance-val');
  const compBadge = $('#kpi-compliance-badge');
  const compSub = $('#kpi-compliance-sub');
  const resVal = $('#kpi-residual-val');
  const resBadge = $('#kpi-residual-badge');
  const resSub = $('#kpi-residual-sub');
  const tbody = $('#dashboard-recent-tbody');
  const advTitle = $('#advisory-title');
  const advText = $('#advisory-text');

  if (measurements && measurements.length > 0) {
    const total = measurements.length;
    const good = measurements.filter(m => m.status === 'Dentro del rango' || (m.value >= 0.5 && m.value <= 1.0)).length;
    const pct = ((good / total) * 100).toFixed(1);
    
    if (compVal) compVal.textContent = pct;
    if (compBadge) {
      compBadge.textContent = pct >= 90 ? 'EXCELENTE' : pct >= 75 ? 'ACEPTABLE' : 'ALERTA';
      compBadge.className = `kpi-badge ${pct >= 90 ? 'badge-good' : pct >= 75 ? 'badge-info' : 'badge-accent'}`;
    }
    if (compSub) compSub.textContent = `${good} de ${total} mediciones en rango normativo`;

    const latest = measurements[0];
    if (resVal) resVal.textContent = latest.value.toFixed(2);
    if (resBadge) {
      const isGood = latest.value >= (latest.min || 0.5) && latest.value <= (latest.max || 1.0);
      resBadge.textContent = isGood ? 'ÓPTIMO' : latest.value < 0.5 ? 'BAJO' : 'ALTO';
      resBadge.className = `kpi-badge ${isGood ? 'badge-good' : 'badge-accent'}`;
    }
    if (resSub) resSub.textContent = `${latest.point || 'Punto de red'} (${latest.date.split(',')[0] || 'Reciente'})`;

    // Render Recent 3 Measurements Table
    if (tbody) {
      const recent3 = measurements.slice(0, 3);
      tbody.innerHTML = recent3.map(m => {
        const isGood = m.status === 'Dentro del rango' || (m.value >= 0.5 && m.value <= 1.0);
        return `
          <tr>
            <td>${m.date}</td>
            <td>${m.point || 'Red de distribución'}</td>
            <td><strong>${m.value.toFixed(2)} mg/L</strong></td>
            <td><span class="pill ${isGood ? 'good' : m.value < 0.5 ? 'warn' : 'bad'}">${m.status || (isGood ? 'Dentro del rango' : 'Fuera del rango')}</span></td>
          </tr>
        `;
      }).join('');
    }

    // Dynamic Smart Advisory Diagnostic
    if (advTitle && advText) {
      if (latest.value < 0.5) {
        advTitle.textContent = 'Alerta Sanitaria: Residual Bajo';
        advText.textContent = `La última medición (${latest.value.toFixed(2)} mg/L en ${latest.point}) está por debajo de la norma (0.50 mg/L). Se sugiere calibrar el dosificador o incrementar +15% el caudal de solución.`;
      } else if (latest.value > 1.0) {
        advTitle.textContent = 'Atención: Residual Alto';
        advText.textContent = `La medición (${latest.value.toFixed(2)} mg/L) supera el rango superior (1.00 mg/L). Reduzca la apertura de la válvula dosificadora para evitar sabor a cloro en grifo.`;
      } else {
        advTitle.textContent = 'Diagnóstico: Desinfección Óptima';
        advText.textContent = `Residual de ${latest.value.toFixed(2)} mg/L en ${latest.point}. La barrera bactericida está 100% activa contra coliformes y patógenos en toda la red de distribución.`;
      }
    }
  }

  // 3. Water Systems & Volume Stats
  const systems = get('cloragua-systems');
  const sysVal = $('#kpi-systems-val');
  const sysSub = $('#kpi-systems-sub');
  const volVal = $('#kpi-volume-val');
  const volSub = $('#kpi-volume-sub');

  if (sysVal) {
    const count = systems.length || 4;
    sysVal.textContent = count;
    if (sysSub) sysSub.textContent = `~${(count * 450).toLocaleString('es-PE')} beneficiarios protegidos`;
  }

  if (systems.length > 0) {
    const totalLiters = systems.reduce((acc, s) => acc + (parseFloat(s.volume) || 0), 0);
    if (totalLiters > 0 && volVal) {
      volVal.textContent = (totalLiters / 1000).toFixed(1);
      if (volSub) volSub.textContent = `${totalLiters.toLocaleString('es-PE')} L acumulados en reservorios`;
    }
  } else if (state.volume > 0 && volVal) {
    volVal.textContent = (state.volume / 1000).toFixed(1);
    if (volSub) volSub.textContent = `${state.volume.toLocaleString('es-PE', { maximumFractionDigits: 0 })} L en tanque activo (${((state.volume / (state.capacity || state.volume)) * 100).toFixed(0)}% capacidad)`;
  }
}

// Live Dashboard Clock Ticker
setInterval(() => {
  const clockEl = $('#dashboard-live-clock');
  if (clockEl && $('#inicio')?.classList.contains('active')) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });
    clockEl.innerHTML = `<span class="material-symbols-outlined" style="font-size: 15px; color: var(--secondary);">schedule</span> ${dateStr}, ${timeStr} • Telemetría activa`;
  }
}, 1000);

function renderLast() {
  renderDashboardIndicators();
}
renderLast();

// Water Systems Registration
const saveSysBtn = $('#save-system');
if (saveSysBtn) {
  saveSysBtn.onclick = () => {
    const name = ($('#sys-name')?.value || '').trim();
    if (!name) return toast('Ingrese el nombre del sistema.');
    const a = get('cloragua-systems');
    
    const utmZone = $('#sys-utm-zone')?.value || '18S';
    const utmEast = $('#sys-utm-east')?.value ? parseFloat($('#sys-utm-east').value) : null;
    const utmNorth = $('#sys-utm-north')?.value ? parseFloat($('#sys-utm-north').value) : null;
    const utmAlt = $('#sys-utm-alt')?.value ? parseFloat($('#sys-utm-alt').value) : null;

    a.unshift({
      name,
      town: $('#sys-town')?.value || '',
      district: $('#sys-district')?.value || '',
      province: $('#sys-province')?.value || '',
      department: $('#sys-department')?.value || '',
      tank: $('#sys-tank')?.value || '',
      volume: $('#sys-volume')?.value || '',
      person: $('#sys-person')?.value || '',
      notes: $('#sys-notes')?.value || '',
      utmZone,
      utmEast,
      utmNorth,
      utmAlt,
      date: new Date().toLocaleDateString('es-PE')
    });
    put('cloragua-systems', a);
    toast('Sistema y coordenadas UTM guardados.');
    renderSystems();
    renderDashboardIndicators();
    if (window.gotitaReact) window.gotitaReact(`¡Sistema "${name}" registrado con coordenadas UTM con éxito! 📋📍🌟`);
  };
}

function renderSystems() {
  const list = $('#systems-list');
  if (!list) return;
  const a = get('cloragua-systems');
  if (!a.length) {
    list.innerHTML = '<div class="empty-state" style="padding: 24px; text-align: center; color: var(--on-surface-variant);">Aún no hay sistemas registrados. Ingrese uno arriba con sus coordenadas UTM.</div>';
    return;
  }
  list.innerHTML = a.map((x, i) => {
    let utmBadge = '';
    let mapBtn = '';

    if (x.utmEast && x.utmNorth) {
      utmBadge = `<div class="utm-pill-badge"><span class="material-symbols-outlined">pin_drop</span> UTM ${x.utmZone || '18S'}: E ${Number(x.utmEast).toLocaleString('es-PE')} · N ${Number(x.utmNorth).toLocaleString('es-PE')}${x.utmAlt ? ` · ${x.utmAlt} msnm` : ''}</div>`;
      try {
        const { lat, lon } = utmToLatLon(x.utmEast, x.utmNorth, x.utmZone || '18S');
        mapBtn = `<a href="https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}" target="_blank" rel="noopener noreferrer" class="map-view-btn"><span class="material-symbols-outlined" style="font-size: 14px;">map</span> Ver Mapa</a>`;
      } catch (err) {}
    }

    const locText = [x.town, x.district, x.province, x.department].filter(Boolean).join(' · ');

    return `
      <article class="record" style="flex-direction: column; align-items: stretch; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div>
            <h3 style="margin-bottom: 2px;">${x.name} ${mapBtn}</h3>
            <p>${locText || 'Ubicación no especificada'} · ${x.tank || 'Tanque'} · <b>${x.volume ? Number(x.volume).toLocaleString('es-PE') + ' L' : '—'}</b></p>
            ${x.person ? `<p style="font-size: 12px; color: var(--on-surface-variant); margin-top: 2px;">Responsable: ${x.person}</p>` : ''}
            ${utmBadge}
          </div>
          <button class="delete" data-i="${i}" style="align-self: flex-start;">Eliminar</button>
        </div>
        ${x.notes ? `<div style="font-size: 12px; color: var(--on-surface-variant); background: var(--surface-container-high); padding: 8px 12px; border-radius: 8px;"><b>Notas:</b> ${x.notes}</div>` : ''}
      </article>
    `;
  }).join('');

  $$('.delete').forEach(b => {
    b.onclick = () => {
      const items = get('cloragua-systems');
      items.splice(+b.dataset.i, 1);
      put('cloragua-systems', items);
      renderSystems();
      renderDashboardIndicators();
      toast('Sistema eliminado.');
    };
  });
}
renderSystems();

// CSV Export with UTM support
const exportBtn = $('#export-csv');
if (exportBtn) {
  exportBtn.onclick = () => {
    const a = get('cloragua-measurements');
    if (!a.length) return toast('No hay mediciones para exportar.');
    const csv = 'Fecha,Punto,Residual mg/L,Rango Min,Rango Max,Estado,Zona UTM,Este UTM,Norte UTM\n' + a.map(x => `"${x.date}","${x.point}",${x.value},${x.min},${x.max},"${x.status}","${x.utmZone || ''}","${x.utmEast || ''}","${x.utmNorth || ''}"`).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'historial-cloragua-utm.csv';
    link.click();
    URL.revokeObjectURL(url);
    if (window.gotitaReact) window.gotitaReact('¡Historial con Coordenadas UTM exportado en CSV para fiscalización sanitaria! 📊🗺️💾');
  };
}

// Technical Norms
const norm = localStorage.getItem('cloragua-norm-date') || new Date().toLocaleDateString('es-PE');
if ($('#norm-date')) $('#norm-date').textContent = norm;
const updateNormBtn = $('#update-norm');
if (updateNormBtn) {
  updateNormBtn.onclick = () => {
    const d = new Date().toLocaleDateString('es-PE');
    localStorage.setItem('cloragua-norm-date', d);
    if ($('#norm-date')) $('#norm-date').textContent = d;
    toast('Fecha de referencia actualizada.');
    if (window.gotitaReact) window.gotitaReact(`¡Fecha de referencia normativa actualizada a ${d}! 📖`);
  };
}

// Help button
$$('.help').forEach(btn => {
  btn.onclick = () => {
    toast('CLORAGUA: Ingrese volumen y residual para obtener la dosificación exacta recomendada.');
    if (window.gotitaReact) window.gotitaReact('¿Dudas técnicas? ¡Estoy aquí para ayudarte en cualquier cálculo! 💡💧');
  };
});

/* =========================================================
   GOTITA 3D INTERACTIVE MASCOT & MULTI-PAGE ADVICE ENGINE
   ========================================================= */
(function initGotitaUniversal() {
  const pageTips = {
    inicio: [
      "¡Hola! Soy Gotita 💧 ¡Te acompañaré en cada paso para asegurar agua clorada y segura!",
      "¡Consejo! Mantén el cloro residual libre entre 0.5 y 1.0 mg/L en la red de distribución 💧",
      "¡Recuerda! Espera mínimo 30 minutos de tiempo de contacto antes del consumo ⏱️",
      "¡Importante! Calcula siempre con el volumen real de agua, no la capacidad total 📏",
      "¡Cuidado! Nunca mezcles hipoclorito con ácidos u otros químicos ⚠️",
      "¡Genial! La cloración continua protege la salud de toda la comunidad 🌟",
      "¡Splaaash! 🌊 ¡Mueve el cursor o tócame para interactuar en 3D!"
    ],
    dosis: [
      "💧 ¡Paso 1! Ingresa siempre el volumen REAL de agua en el tanque, no la capacidad máxima.",
      "🏷️ ¡Paso 2! Comprueba la concentración de cloro activo en el envase (ej. 7.5% líquido o 65% granulado).",
      "🎯 ¡Paso 3! La meta recomendada de cloro residual libre en reservorio suele ser de 0.80 a 1.00 mg/L.",
      "💡 La dosis teórica compensa el cloro actual: Dosis = (Objetivo − Actual + Demanda).",
      "⚠️ Si usas hipoclorito de calcio (sólido), disuélvelo en agua antes de dosificarlo al reservorio."
    ],
    volumen: [
      "📏 ¡Mide el tirante de agua! La altura real del agua es fundamental para no sobre-dosificar.",
      "🏰 Tanque cilíndrico: Volumen = π × (Diámetro/2)² × Altura de agua.",
      "📦 Cisterna rectangular: Volumen = Largo × Ancho × Altura de agua.",
      "⚡ Al calcular el volumen, haz clic en 'Usar este volumen para dosificar' y se transferirá automáticamente.",
      "🌊 Recuerda descontar el volumen muerto inferior a la tubería de salida."
    ],
    verificar: [
      "🔬 Utiliza pastillas DPD-1 o reactivo líquido para medir exclusivamente cloro residual libre.",
      "⏱️ Realiza la medición tras cumplir al menos 30 minutos de tiempo de contacto en el reservorio.",
      "🟢 Rango óptimo según D.S. 031-2010-SA: entre 0.50 y 1.00 mg/L en la red de distribución.",
      "⚠️ Si obtienes < 0.5 mg/L: Aumenta la dosis o caudal para prevenir riesgos bacteriológicos.",
      "🚫 Si obtienes > 1.2 mg/L: Ajusta el dosificador para evitar olores y sabores molestos a la población."
    ],
    calibrar: [
      "🧪 Mide la descarga con una probeta graduada y un cronómetro durante exactamente 1 minuto.",
      "⚙️ Caudal del dosificador (mL/min) = [Caudal de agua (L/h) × Dosis (mg/L)] / [% Cloro × 600].",
      "🔄 Repite la medición 3 veces y saca el promedio para calibrar la perilla con exactitud.",
      "🔍 Verifica periódicamente que no haya sedimentos ni sarro obstruyendo la manguera de succión."
    ],
    solucion: [
      "🦺 ¡Seguridad indispensable! Usa guantes de nitrilo/jebe, gafas de seguridad y mascarilla.",
      "⚠️ ¡Regla vital! Vierte siempre el producto sobre el agua; NUNCA agregues agua sobre el cloro concentrado.",
      "🪣 Si preparas solución madre con hipoclorito de calcio al 65%, deja decantar la cal 30 minutos.",
      "🌬️ Realiza la mezcla en un lugar sombreado y con buena ventilación natural."
    ],
    sistemas: [
      "📋 Registra cada sistema de agua (JASS, comité, caserío) con sus dimensiones y datos de contacto.",
      "👨‍🔧 Mantener el nombre del operador responsable agiliza la coordinación en emergencias sanitarias.",
      "📝 Anota en observaciones el tipo de dosificador (goteo, C-SAP, bomba dosificadora) instalado."
    ],
    historial: [
      "📊 La trazabilidad de mediciones demuestra el cumplimiento de estándares sanitarios.",
      "💾 Puedes descargar tus registros en formato CSV haciendo clic en 'Exportar CSV' para tus informes.",
      "🔍 Utiliza el buscador y filtro por estado para identificar rápidamente sectores con bajo residual."
    ],
    normativa: [
      "📖 D.S. N.° 031-2010-SA: Norma sanitaria del Perú para calidad del agua de consumo humano.",
      "🌐 Recomendación OMS: Cloro residual libre ≥ 0.5 mg/L tras 30 min de contacto a pH < 8.0.",
      "💡 Para que la cloración sea 100% efectiva, la turbiedad del agua debe ser menor a 5 UNT."
    ]
  };

  const pageLabels = {
    inicio: "📍 Panel Principal",
    dosis: "📍 Calcular Dosis",
    volumen: "📍 Volumen del Tanque",
    verificar: "📍 Verificar Residual",
    calibrar: "📍 Calibrar Dosificador",
    solucion: "📍 Preparar Solución",
    sistemas: "📍 Sistemas de Agua",
    historial: "📍 Historial",
    normativa: "📍 Normativa"
  };

  let currentPage = 'inicio';
  let tipIndices = {
    inicio: 0, dosis: 0, volumen: 0, verificar: 0, calibrar: 0, solucion: 0, sistemas: 0, historial: 0, normativa: 0
  };

  // Elements
  const heroCanvas = document.getElementById('gotita-3d-canvas');
  const heroSpeech = document.getElementById('gotita-speech');
  const heroShadow = document.querySelector('.gotita-shadow');
  
  const companionWidget = document.getElementById('gotita-companion');
  const companionCanvas = document.getElementById('gotita-companion-canvas');
  const companionSpeech = document.getElementById('gotita-companion-speech');
  const pageTag = document.getElementById('gotita-current-page-tag');
  const dockToggle = document.getElementById('gotita-dock-toggle');
  const minimizeBtn = document.getElementById('gotita-minimize-btn');

  // Shared Gotita Physical Model
  const model = {
    vy: 0,
    squishX: 1,
    squishY: 1,
    squishVx: 0,
    squishVy: 0,
    rotX: 0,
    rotY: 0,
    targetRotX: 0,
    targetRotY: 0,
    spinAngle: 0,
    spinSpeed: 0,
    blink: 0,
    blinkTarget: 0,
    blinkTimer: 0,
    eyeLookX: 0,
    eyeLookY: 0,
    targetEyeX: 0,
    targetEyeY: 0,
    isHappy: false,
    happyTimer: 0,
    isTickled: false,
    tickleTimer: 0,
    wavePhase: 0,
    isWaving: false,
    waveTimer: 0,
    bubbles: [],
    splashes: [],
    hearts: []
  };

  // Web Audio Synthesizer for Cute Enthusiastic Water Droplet Sounds
  let audioCtx = null;
  let isMuted = false;
  try {
    isMuted = localStorage.getItem('cloragua_gotita_muted') === 'true';
  } catch (e) {}

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // 1. Cute Enthusiastic Giggle / Laugh Sound ("ji-ji-ji-ji-jiii!")
  function playGotitaGiggleSound() {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const baseFreq = 580 + (Math.random() - 0.5) * 80;
      const bursts = 6;
      const burstSpacing = 0.082;
      const burstDuration = 0.07;

      for (let i = 0; i < bursts; i++) {
        const startTime = now + i * burstSpacing;
        let pitch = baseFreq + Math.sin(i * 1.4) * 60 + (i * 30);
        if (i === bursts - 1) pitch += 150;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, startTime);
        osc.frequency.exponentialRampToValueAtTime(pitch * 1.22, startTime + 0.025);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.94, startTime + burstDuration);

        const vibrato = ctx.createOscillator();
        vibrato.frequency.value = 36 + Math.random() * 8;
        const vibratoGain = ctx.createGain();
        vibratoGain.gain.value = 28;
        vibrato.connect(osc.frequency);
        vibrato.start(startTime);
        vibrato.stop(startTime + burstDuration);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(pitch * 1.5, startTime);
        filter.Q.value = 4.2;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.22, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + burstDuration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + burstDuration + 0.01);

        const bubble = ctx.createOscillator();
        bubble.type = 'sine';
        bubble.frequency.setValueAtTime(pitch * 2.2, startTime);
        bubble.frequency.exponentialRampToValueAtTime(pitch * 3.6, startTime + 0.035);

        const bubbleGain = ctx.createGain();
        bubbleGain.gain.setValueAtTime(0.001, startTime);
        bubbleGain.gain.linearRampToValueAtTime(0.08, startTime + 0.01);
        bubbleGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.04);

        bubble.connect(bubbleGain);
        bubbleGain.connect(ctx.destination);

        bubble.start(startTime);
        bubble.stop(startTime + 0.045);
      }

      const chimeTime = now + bursts * burstSpacing;
      const chimeOsc = ctx.createOscillator();
      chimeOsc.type = 'triangle';
      chimeOsc.frequency.setValueAtTime(baseFreq * 2.6, chimeTime);
      chimeOsc.frequency.exponentialRampToValueAtTime(baseFreq * 3.4, chimeTime + 0.12);

      const chimeGain = ctx.createGain();
      chimeGain.gain.setValueAtTime(0.001, chimeTime);
      chimeGain.gain.linearRampToValueAtTime(0.09, chimeTime + 0.02);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, chimeTime + 0.16);

      chimeOsc.connect(chimeGain);
      chimeGain.connect(ctx.destination);

      chimeOsc.start(chimeTime);
      chimeOsc.stop(chimeTime + 0.18);
    } catch (e) {
      console.warn('Audio giggle error:', e);
    }
  }

  // 2. Cute Enthusiastic Jump / Boing Sound ("¡Boi-i-ing! ✨")
  function playGotitaJumpSound() {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const startFreq = 280 + Math.random() * 40;

      // Primary spring bounce sweep
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(560, now + 0.11);
      osc.frequency.exponentialRampToValueAtTime(1180, now + 0.22);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(850, now);
      filter.frequency.exponentialRampToValueAtTime(1450, now + 0.22);
      filter.Q.value = 3.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.02);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.34);

      // Water pop bubble layer on takeoff
      const popOsc = ctx.createOscillator();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(980, now);
      popOsc.frequency.exponentialRampToValueAtTime(1950, now + 0.04);
      popOsc.frequency.exponentialRampToValueAtTime(450, now + 0.09);

      const popGain = ctx.createGain();
      popGain.gain.setValueAtTime(0.001, now);
      popGain.gain.linearRampToValueAtTime(0.14, now + 0.015);
      popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      popOsc.connect(popGain);
      popGain.connect(ctx.destination);

      popOsc.start(now);
      popOsc.stop(now + 0.1);

      // Cheerful high sparkle on the peak of the jump
      const peakTime = now + 0.16;
      const sparkle = ctx.createOscillator();
      sparkle.type = 'sine';
      sparkle.frequency.setValueAtTime(1420, peakTime);
      sparkle.frequency.exponentialRampToValueAtTime(1980, peakTime + 0.12);

      const sparkleGain = ctx.createGain();
      sparkleGain.gain.setValueAtTime(0.001, peakTime);
      sparkleGain.gain.linearRampToValueAtTime(0.1, peakTime + 0.02);
      sparkleGain.gain.exponentialRampToValueAtTime(0.0001, peakTime + 0.18);

      sparkle.connect(sparkleGain);
      sparkleGain.connect(ctx.destination);

      sparkle.start(peakTime);
      sparkle.stop(peakTime + 0.2);
    } catch (e) {
      console.warn('Audio jump error:', e);
    }
  }

  // 3. Cute Enthusiastic Spin / Vortex Sparkle Sound ("¡Wuuuui! 🌀✨")
  function playGotitaSpinSound() {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Fast cheerful ascending water marimba arpeggio (C, E, G, A, C, E)
      const notes = [587.33, 659.25, 783.99, 880.00, 1046.50, 1318.51];
      const spacing = 0.042;

      notes.forEach((freq, idx) => {
        const t = now + idx * spacing;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.08, t + 0.06);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq * 1.4;
        filter.Q.value = 5.0;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.14, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.15);
      });

      // Whirling water whoosh swept filter
      const whooshOsc = ctx.createOscillator();
      whooshOsc.type = 'triangle';
      whooshOsc.frequency.setValueAtTime(320, now);
      whooshOsc.frequency.exponentialRampToValueAtTime(840, now + 0.15);
      whooshOsc.frequency.exponentialRampToValueAtTime(420, now + 0.32);

      const whooshFilter = ctx.createBiquadFilter();
      whooshFilter.type = 'lowpass';
      whooshFilter.frequency.setValueAtTime(500, now);
      whooshFilter.frequency.exponentialRampToValueAtTime(2400, now + 0.16);
      whooshFilter.frequency.exponentialRampToValueAtTime(700, now + 0.34);
      whooshFilter.Q.value = 4.0;

      const whooshGain = ctx.createGain();
      whooshGain.gain.setValueAtTime(0.001, now);
      whooshGain.gain.linearRampToValueAtTime(0.12, now + 0.06);
      whooshGain.gain.linearRampToValueAtTime(0.12, now + 0.2);
      whooshGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      whooshOsc.connect(whooshFilter);
      whooshFilter.connect(whooshGain);
      whooshGain.connect(ctx.destination);

      whooshOsc.start(now);
      whooshOsc.stop(now + 0.36);

      // Magical completion sparkle chimes
      const finishTime = now + notes.length * spacing;
      [1760, 2637].forEach((chimeFreq, i) => {
        const ct = finishTime + i * 0.04;
        const cOsc = ctx.createOscillator();
        cOsc.type = 'sine';
        cOsc.frequency.setValueAtTime(chimeFreq, ct);
        cOsc.frequency.exponentialRampToValueAtTime(chimeFreq * 1.05, ct + 0.15);

        const cGain = ctx.createGain();
        cGain.gain.setValueAtTime(0.001, ct);
        cGain.gain.linearRampToValueAtTime(0.08, ct + 0.015);
        cGain.gain.exponentialRampToValueAtTime(0.0001, ct + 0.22);

        cOsc.connect(cGain);
        cGain.connect(ctx.destination);

        cOsc.start(ct);
        cOsc.stop(ct + 0.24);
      });
    } catch (e) {
      console.warn('Audio spin error:', e);
    }
  }

  // 4. Cute Greeting Wave Sound ("¡Holi! 👋💧")
  function playGotitaWaveSound() {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [784, 1046].forEach((f, i) => {
        const t = now + i * 0.09;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.exponentialRampToValueAtTime(f * 1.15, t + 0.08);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.18);
      });
    } catch (e) {
      console.warn('Audio wave error:', e);
    }
  }

  // -------------------------------------------------------------
  // BACKGROUND MUSIC SYNTHESIZER: "Calypso Tropical del Mar" 🌊🏖️
  // (Lively Caribbean Steel Pan, Bubbly Ocean Plucks, Bongos & Sea Calypso)
  // -------------------------------------------------------------
  let isBgmPlaying = false;
  let bgmTimer = null;
  let bgmMasterGain = null;
  let nextBeatTime = 0;
  let currentBeat = 0;
  const TOTAL_BEATS = 64;
  const BPM = 136;
  const SECONDS_PER_BEAT = 60 / BPM;
  const LOOKAHEAD_MS = 35;
  const SCHEDULE_AHEAD_SEC = 0.18;

  const NOTE_FREQS = {
    'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'Bb2': 116.54, 'C3': 130.81, 'D3': 146.83, 'Eb3': 155.56, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'Bb4': 466.16,
    'C5': 523.25, 'D5': 587.33, 'Eb5': 622.25, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'Bb5': 932.33,
    'C6': 1046.50, 'D6': 1174.66, 'E6': 1318.51, 'F6': 1396.91, 'G6': 1567.98
  };

  // Lead Melody: [beatOffset, noteName, durationInBeats, instrumentType: 'steel'|'chime'|'bubble']
  const BGM_MELODY = [
    // --- SECTION A: "Bajo el Mar" Tropical Calypso Theme (Bars 1-4) ---
    [0.0, 'F4', 0.45, 'steel'], [0.5, 'A4', 0.45, 'steel'], [1.0, 'C5', 0.7, 'steel'], [1.75, 'D5', 0.45, 'steel'],
    [2.25, 'C5', 0.65, 'steel'], [3.0, 'A4', 0.45, 'steel'], [3.5, 'F4', 0.45, 'steel'],
    [4.0, 'Bb4', 0.45, 'steel'], [4.5, 'Bb4', 0.45, 'steel'], [5.0, 'D5', 0.7, 'steel'], [5.75, 'C5', 0.45, 'steel'],
    [6.25, 'Bb4', 0.65, 'steel'], [7.0, 'A4', 0.45, 'steel'], [7.5, 'G4', 0.45, 'steel'],
    [8.0, 'C5', 0.5, 'steel'], [8.5, 'A4', 0.5, 'steel'], [9.0, 'F4', 0.7, 'steel'], [9.75, 'G4', 0.45, 'steel'],
    [10.25, 'A4', 0.65, 'steel'], [11.0, 'F4', 0.8, 'steel'],
    [12.0, 'G4', 0.45, 'steel'], [12.5, 'A4', 0.45, 'steel'], [13.0, 'Bb4', 0.7, 'steel'], [13.75, 'G4', 0.45, 'steel'],
    [14.25, 'C5', 1.4, 'steel'],
    [15.0, 'A4', 0.25, 'bubble'], [15.25, 'C5', 0.25, 'bubble'], [15.5, 'F5', 0.25, 'bubble'], [15.75, 'A5', 0.25, 'bubble'],

    // --- SECTION A2: Calypso Chorus Wave (Bars 5-8) ---
    [16.0, 'F4', 0.45, 'steel'], [16.5, 'A4', 0.45, 'steel'], [17.0, 'C5', 0.7, 'steel'], [17.75, 'D5', 0.45, 'steel'],
    [18.25, 'C5', 0.65, 'steel'], [19.0, 'A4', 0.45, 'steel'], [19.5, 'F4', 0.45, 'steel'],
    [20.0, 'Bb4', 0.45, 'steel'], [20.5, 'D5', 0.45, 'steel'], [21.0, 'F5', 0.7, 'steel'], [21.75, 'D5', 0.45, 'steel'],
    [22.25, 'C5', 0.65, 'steel'], [23.0, 'A4', 0.45, 'steel'], [23.5, 'F4', 0.45, 'steel'],
    [24.0, 'G4', 0.45, 'steel'], [24.5, 'A4', 0.45, 'steel'], [25.0, 'Bb4', 0.7, 'steel'], [25.75, 'C5', 0.45, 'steel'],
    [26.25, 'D5', 0.65, 'steel'], [27.0, 'C5', 0.45, 'steel'], [27.5, 'Bb4', 0.45, 'steel'],
    [28.0, 'A4', 0.5, 'steel'], [28.5, 'G4', 0.5, 'steel'], [29.0, 'F4', 1.8, 'steel'],
    [30.5, 'C5', 0.25, 'chime'], [30.75, 'E5', 0.25, 'chime'], [31.0, 'G5', 0.25, 'chime'], [31.25, 'C6', 0.5, 'chime'],

    // --- SECTION B: High Oceanic Celebration (Bars 9-12) ---
    [32.0, 'C5', 0.45, 'steel'], [32.5, 'C5', 0.45, 'steel'], [33.0, 'F5', 0.75, 'steel'], [33.75, 'E5', 0.45, 'steel'],
    [34.25, 'D5', 0.65, 'steel'], [35.0, 'C5', 0.45, 'steel'], [35.5, 'A4', 0.45, 'steel'],
    [36.0, 'Bb4', 0.45, 'steel'], [36.5, 'D5', 0.45, 'steel'], [37.0, 'F5', 0.75, 'steel'], [37.75, 'D5', 0.45, 'steel'],
    [38.25, 'C5', 0.65, 'steel'], [39.0, 'A4', 0.45, 'steel'], [39.5, 'F4', 0.45, 'steel'],
    [40.0, 'G4', 0.45, 'steel'], [40.5, 'G4', 0.45, 'steel'], [41.0, 'G4', 0.7, 'steel'], [41.75, 'A4', 0.45, 'steel'],
    [42.25, 'Bb4', 0.65, 'steel'], [43.0, 'A4', 0.45, 'steel'], [43.5, 'G4', 0.45, 'steel'],
    [44.0, 'A4', 0.5, 'steel'], [44.5, 'C5', 0.5, 'steel'], [45.0, 'F5', 1.4, 'steel'],
    [46.5, 'F5', 0.25, 'bubble'], [46.75, 'A5', 0.25, 'bubble'], [47.0, 'C6', 0.25, 'bubble'], [47.25, 'F6', 0.6, 'bubble'],

    // --- SECTION B2: Grand Sea Carnival & Sparkle Splash Finale (Bars 13-16) ---
    [48.0, 'C5', 0.45, 'steel'], [48.5, 'C5', 0.45, 'steel'], [49.0, 'F5', 0.75, 'steel'], [49.75, 'E5', 0.45, 'steel'],
    [50.25, 'D5', 0.65, 'steel'], [51.0, 'C5', 0.45, 'steel'], [51.5, 'A4', 0.45, 'steel'],
    [52.0, 'Bb4', 0.45, 'steel'], [52.5, 'D5', 0.45, 'steel'], [53.0, 'G5', 0.75, 'steel'], [53.75, 'F5', 0.45, 'steel'],
    [54.25, 'E5', 0.65, 'steel'], [55.0, 'D5', 0.45, 'steel'], [55.5, 'C5', 0.45, 'steel'],
    [56.0, 'D5', 0.45, 'steel'], [56.5, 'E5', 0.45, 'steel'], [57.0, 'F5', 0.75, 'steel'], [57.75, 'G5', 0.45, 'steel'],
    [58.25, 'A5', 0.65, 'steel'], [59.0, 'G5', 0.45, 'steel'], [59.5, 'F5', 0.45, 'steel'],
    [60.0, 'F5', 1.8, 'steel'],
    // Ocean sparkle cascade
    [61.5, 'A4', 0.2, 'chime'], [61.75, 'C5', 0.2, 'chime'], [62.0, 'F5', 0.2, 'chime'], [62.25, 'A5', 0.2, 'chime'], [62.5, 'C6', 0.2, 'chime'], [62.75, 'F6', 0.2, 'chime'], [63.0, 'G6', 0.8, 'chime']
  ];

  // Bouncy Calypso Bassline (Root & 5th with syncopated reggae/calypso bounce)
  const BASS_PROGRESSION = [
    ['F2', 'C3', 'F2', 'A2'], // Bar 1 (F)
    ['F2', 'C3', 'F2', 'C3'], // Bar 2 (F)
    ['Bb2', 'F2', 'Bb2', 'D3'], // Bar 3 (Bb)
    ['Bb2', 'F2', 'Bb2', 'D3'], // Bar 4 (Bb)
    ['F2', 'C3', 'F2', 'C3'], // Bar 5 (F)
    ['C3', 'G2', 'C3', 'E3'], // Bar 6 (C)
    ['F2', 'C3', 'F2', 'A2'], // Bar 7 (F)
    ['C3', 'G2', 'C3', 'E3'], // Bar 8 (C)
    ['F2', 'C3', 'F2', 'A2'], // Bar 9 (F)
    ['Bb2', 'F2', 'Bb2', 'D3'], // Bar 10 (Bb)
    ['C3', 'G2', 'C3', 'G2'], // Bar 11 (C)
    ['F2', 'C3', 'F2', 'C3'], // Bar 12 (F)
    ['F2', 'C3', 'F2', 'A2'], // Bar 13 (F)
    ['Bb2', 'F2', 'Bb2', 'D3'], // Bar 14 (Bb)
    ['C3', 'G2', 'C3', 'E3'], // Bar 15 (C)
    ['F2', 'C3', 'F2', 'C3']  // Bar 16 (F)
  ];

  function getBgmGain(ctx) {
    if (!bgmMasterGain) {
      bgmMasterGain = ctx.createGain();
      bgmMasterGain.gain.setValueAtTime(0.34, ctx.currentTime);
      bgmMasterGain.connect(ctx.destination);
    }
    return bgmMasterGain;
  }

  // 1. Tropical Steel Pan / Calypso Marimba Synthesizer
  function synthSteelDrum(ctx, freq, t, durSec) {
    const master = getBgmGain(ctx);

    // Fundamental Caribbean Steel Pan tone
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, t);

    // Metallic overtone (2.76x ratio gives classic steel pan harmonic)
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2.76, t);

    // Third sparkle overtone
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 4.02, t);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.8, t);
    filter.Q.value = 2.4;

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.001, t);
    gain1.gain.linearRampToValueAtTime(0.25, t + 0.008);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(durSec * 1.1, 0.45));

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.001, t);
    gain2.gain.linearRampToValueAtTime(0.09, t + 0.005);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0.001, t);
    gain3.gain.linearRampToValueAtTime(0.04, t + 0.004);
    gain3.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    osc1.connect(filter);
    filter.connect(gain1);
    gain1.connect(master);

    osc2.connect(gain2);
    gain2.connect(master);

    osc3.connect(gain3);
    gain3.connect(master);

    osc1.start(t);
    osc1.stop(t + 0.5);
    osc2.start(t);
    osc2.stop(t + 0.2);
    osc3.start(t);
    osc3.stop(t + 0.12);
  }

  // 2. Water Droplet / Sea Bubble Pop Pluck Synthesizer
  function synthBubblePluck(ctx, freq, t) {
    const master = getBgmGain(ctx);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    // Frequency sweeps rapidly upward mimicking a popping water bubble
    osc.frequency.setValueAtTime(freq * 0.7, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.45, t + 0.06);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.2, t);
    filter.Q.value = 6.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  // 3. Sparkle Ocean Chime / Glockenspiel
  function synthChimeNote(ctx, freq, t, durSec) {
    const master = getBgmGain(ctx);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.015, t + durSec);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.19, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durSec);

    osc.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + durSec + 0.05);
  }

  // 4. Bouncy Calypso Bass
  function synthBassNote(ctx, freq, t) {
    const master = getBgmGain(ctx);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    // Warm second harmonic for fat island acoustic bass
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq, t);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, t);
    filter.frequency.exponentialRampToValueAtTime(160, t + 0.28);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.001, t);
    gain2.gain.linearRampToValueAtTime(0.12, t + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + 0.38);
    osc2.start(t);
    osc2.stop(t + 0.28);
  }

  // 5. Tropical Conga / Bongo Drum (Caribbean Percussion)
  function synthBongo(ctx, isHigh, t) {
    const master = getBgmGain(ctx);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const startFreq = isHigh ? 380 : 220;
    const endFreq = isHigh ? 240 : 130;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.05);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(isHigh ? 0.16 : 0.22, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (isHigh ? 0.08 : 0.14));

    osc.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  // 6. Caribbean Maraca / Sea Foam Shaker
  function synthMaraca(ctx, t, accent) {
    const master = getBgmGain(ctx);
    const bufferSize = ctx.sampleRate * 0.035;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(accent ? 7200 : 5800, t);
    filter.Q.value = 2.0;

    const gain = ctx.createGain();
    const vol = accent ? 0.12 : 0.06;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (accent ? 0.045 : 0.03));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    noise.start(t);
    noise.stop(t + 0.05);
  }

  // Schedule a beat slice of Caribbean Sea Calypso
  function scheduleBeat(beatNum, time) {
    const ctx = getAudioContext();
    if (!ctx) return;

    // 1. Lead Melody Notes (Steel Pan, Chimes, Bubble Drops)
    BGM_MELODY.forEach(([offset, note, dur, inst]) => {
      if (Math.abs(offset - beatNum) < 0.01 || (offset > beatNum && offset < beatNum + 1)) {
        const noteTime = time + (offset - beatNum) * SECONDS_PER_BEAT;
        const freq = NOTE_FREQS[note];
        if (freq) {
          const noteDur = dur * SECONDS_PER_BEAT;
          if (inst === 'bubble') {
            synthBubblePluck(ctx, freq, noteTime);
          } else if (inst === 'chime') {
            synthChimeNote(ctx, freq, noteTime, noteDur);
          } else {
            synthSteelDrum(ctx, freq, noteTime, noteDur);
          }
        }
      }
    });

    // 2. Calypso Bass Groove (beats 0, 1.5, 2.5, 3)
    const barIndex = Math.floor(beatNum / 4) % 16;
    const beatInBar = Math.floor(beatNum) % 4;
    const barBass = BASS_PROGRESSION[barIndex];
    if (barBass && barBass[beatInBar]) {
      const bassFreq = NOTE_FREQS[barBass[beatInBar]];
      if (bassFreq) {
        synthBassNote(ctx, bassFreq, time);
      }
    }

    // 3. Caribbean Percussion Groove (Bongos, Congas, Maracas)
    // Maraca 16th groove
    synthMaraca(ctx, time, beatInBar === 0 || beatInBar === 2);
    synthMaraca(ctx, time + SECONDS_PER_BEAT * 0.25, false);
    synthMaraca(ctx, time + SECONDS_PER_BEAT * 0.5, true);
    synthMaraca(ctx, time + SECONDS_PER_BEAT * 0.75, false);

    // Bongo Caribbean syncopation
    if (beatInBar === 0) {
      synthBongo(ctx, false, time); // Low bongo downbeat
    } else if (beatInBar === 1) {
      synthBongo(ctx, true, time + SECONDS_PER_BEAT * 0.5); // High bongo offbeat
    } else if (beatInBar === 2) {
      synthBongo(ctx, true, time); // High slap
      synthBongo(ctx, false, time + SECONDS_PER_BEAT * 0.75); // Low bounce
    } else if (beatInBar === 3) {
      synthBongo(ctx, true, time + SECONDS_PER_BEAT * 0.5);
    }
  }

  function bgmScheduler() {
    if (!isBgmPlaying) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    while (nextBeatTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      scheduleBeat(currentBeat, nextBeatTime);
      nextBeatTime += SECONDS_PER_BEAT;
      currentBeat = (currentBeat + 1) % TOTAL_BEATS;

      // Subtle gentle rhythmic dance bounce for Gotita while music plays
      if (currentBeat % 2 === 0 && !model.isHappy && model.vy === 0) {
        model.vy = -1.2;
        model.squishX = 0.95;
        model.squishY = 1.05;
      }
    }
  }

  function updateBgmButtonsUI() {
    const headerBtn = document.getElementById('bgm-toggle-btn');
    const heroBtn = document.getElementById('gotita-music-btn');
    const companionBtn = document.getElementById('companion-music-btn');

    if (headerBtn) {
      headerBtn.classList.toggle('is-playing', isBgmPlaying);
      const label = headerBtn.querySelector('.bgm-label');
      const icon = headerBtn.querySelector('.bgm-icon');
      if (label) label.textContent = isBgmPlaying ? 'Pausar' : 'Música';
      if (icon) icon.textContent = isBgmPlaying ? '⏸' : '🎵';
      headerBtn.title = isBgmPlaying ? 'Pausar música de fondo' : 'Reproducir música alegre de fondo';
    }

    if (heroBtn) {
      heroBtn.classList.toggle('is-playing', isBgmPlaying);
      heroBtn.textContent = isBgmPlaying ? '⏸ Pausar' : '🎵 Música';
      heroBtn.title = isBgmPlaying ? 'Pausar música' : 'Reproducir música alegre';
    }

    if (companionBtn) {
      companionBtn.classList.toggle('is-playing', isBgmPlaying);
      companionBtn.textContent = isBgmPlaying ? '⏸' : '🎵';
      companionBtn.title = isBgmPlaying ? 'Pausar música' : 'Reproducir música alegre';
    }
  }

  function startBgm() {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    isBgmPlaying = true;
    nextBeatTime = ctx.currentTime + 0.05;
    currentBeat = 0;

    if (bgmTimer) clearInterval(bgmTimer);
    bgmTimer = setInterval(bgmScheduler, LOOKAHEAD_MS);
    updateBgmButtonsUI();
    setAllSpeech("¡Música alegre iniciada! 🎵 Disfruta tu trabajo en CLORAGUA.");
    createTickleHearts(3);
  }

  function stopBgm() {
    isBgmPlaying = false;
    if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
    updateBgmButtonsUI();
    setAllSpeech("Música en pausa ⏸️ Puedes reanudarla cuando quieras.");
  }

  function toggleBgm() {
    if (isBgmPlaying) {
      stopBgm();
    } else {
      startBgm();
    }
  }

  // Populate floating bubbles
  for (let i = 0; i < 9; i++) {
    model.bubbles.push({
      x: 30 + Math.random() * 180,
      y: 30 + Math.random() * 160,
      r: 2.5 + Math.random() * 4.5,
      speed: 0.35 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2
    });
  }

  function createSplash(num = 8) {
    for (let i = 0; i < num; i++) {
      const angle = (Math.PI * 2 * i) / num + (Math.random() - 0.5);
      const speed = 2.5 + Math.random() * 3.5;
      model.splashes.push({
        x: (Math.random() - 0.5) * 30,
        y: 35 + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        r: 2.5 + Math.random() * 3.5,
        alpha: 1,
        life: 1
      });
    }
  }

  function createTickleHearts(num = 5) {
    for (let i = 0; i < num; i++) {
      model.hearts.push({
        x: (Math.random() - 0.5) * 45,
        y: (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 2.2,
        vy: -1.5 - Math.random() * 2.2,
        size: 10 + Math.random() * 6,
        rot: (Math.random() - 0.5) * 0.5,
        life: 1,
        symbol: Math.random() > 0.4 ? '✨' : (Math.random() > 0.5 ? '💖' : '💧')
      });
    }
  }

  function setAllSpeech(text) {
    if (heroSpeech) {
      heroSpeech.textContent = text;
      heroSpeech.style.transform = 'scale(1.06)';
      setTimeout(() => { heroSpeech.style.transform = ''; }, 240);
    }
    if (companionSpeech) {
      companionSpeech.textContent = text;
      companionSpeech.classList.add('pop');
      setTimeout(() => { companionSpeech.classList.remove('pop'); }, 240);
    }
  }

  // Tickle / Giggle phrases
  const ticklePhrases = [
    "¡Jajajajaja! ¡Qué cosquillas me da! 🤭💧",
    "¡Jijijiji! ¡Ay no, tantas cosquillitas! ✨🌊",
    "¡Jejejeje! ¡Cosquillitas acuáticas refrescantes! 💦😄",
    "¡Jajaja! ¡Basta, basta que me evaporó de la risa! 💧🎉",
    "¡Jijiji! ¡Soy la gotita más cosquilluda y alegre! 🌊✨",
    "¡Jajajaja! ¡Qué emoción trabajar con agua segura! 💧🥰",
    "¡Jijiji! ¡Cosquillitas directas al corazón del agua! 💖💧"
  ];

  function tickle() {
    playGotitaGiggleSound();
    model.isTickled = true;
    model.tickleTimer = 75;
    model.happyTimer = 85;
    model.isHappy = true;
    model.vy = -6.5;
    model.squishX = 0.74;
    model.squishY = 1.36;
    createSplash(12);
    createTickleHearts(6);
    
    const phrase = ticklePhrases[Math.floor(Math.random() * ticklePhrases.length)];
    setAllSpeech(phrase);
  }

  // Action Phrases
  const jumpPhrases = [
    "¡Boiiing! ⚡ ¡Salto de energía y agua pura! 💧",
    "¡Hop, hop! 🌊 ¡Listos para calcular con precisión!",
    "¡Arriba! ⚡ ¡Cero microorganismos en el sistema! 🛡️",
    "¡Súper salto! 💧 ¡Garantizando cloración óptima!",
    "¡Boing! 🌊 ¡Con toda la vitalidad para operar!"
  ];

  const spinPhrases = [
    "¡Wuuuui! 🌀 ¡Giro de 360° en el reservorio! ✨",
    "¡Yujuuu! 🌀 ¡Mezcla uniforme y cloración perfecta! 💧",
    "¡Tornado acuático! 🌀 ¡Todo desinfectado y protegido! 🛡️",
    "¡Giro mágico! 🌀 ¡Distribución exacta en cada gota! 🌊"
  ];

  const wavePhrases = [
    "¡Hola, operador! ¡Cuidemos juntos el agua segura! 💧👋",
    "¡Saludos! Aquí estoy para ayudarte con cada cálculo técnico 👋✨",
    "¡Hola, hola! 🌊 ¡Un gran día para monitorear el cloro residual! 👋"
  ];

  function jump(customText, silent = false) {
    if (!silent) {
      playGotitaJumpSound();
    }
    model.vy = -7;
    model.squishX = 0.8;
    model.squishY = 1.3;
    model.isHappy = true;
    model.happyTimer = 45;
    createSplash(8);
    if (customText) {
      setAllSpeech(customText);
    }
    if (heroShadow) {
      heroShadow.style.transform = 'translateX(-50%) scale(0.65)';
      heroShadow.style.opacity = '0.3';
      setTimeout(() => {
        heroShadow.style.transform = 'translateX(-50%) scale(1)';
        heroShadow.style.opacity = '0.55';
      }, 400);
    }
  }

  function wave(customText) {
    playGotitaWaveSound();
    model.isWaving = true;
    model.waveTimer = 90;
    model.isHappy = true;
    model.happyTimer = 60;
    model.vy = -3;
    createSplash(5);
    if (customText) {
      setAllSpeech(customText);
    }
  }

  function spin(customText) {
    playGotitaSpinSound();
    model.spinSpeed = (Math.PI * 2) / 24;
    model.vy = -5;
    model.squishX = 0.85;
    model.squishY = 1.25;
    model.isHappy = true;
    model.happyTimer = 50;
    createSplash(10);
    createTickleHearts(4);
    if (customText) {
      setAllSpeech(customText);
    }
  }

  function nextTip() {
    const list = pageTips[currentPage] || pageTips.inicio;
    tipIndices[currentPage] = (tipIndices[currentPage] + 1) % list.length;
    setAllSpeech(list[tipIndices[currentPage]]);
    jump();
  }

  // Global Page Switch Handler (Silent navigation without audio playback)
  window.gotitaSetPage = function(pageId) {
    currentPage = pageId;
    if (pageTag) pageTag.textContent = pageLabels[pageId] || "📍 Asistente";
    const list = pageTips[pageId] || pageTips.inicio;
    const currentTip = list[tipIndices[pageId] % list.length];
    setAllSpeech(currentTip);
    // Silent animation when navigating between modules
    jump(null, true);
  };

  // Custom reaction trigger for calculations and events
  window.gotitaReact = function(customText) {
    setAllSpeech(customText);
    jump();
  };

  // Mute / Sound Toggle Logic
  function updateMuteButtonsUI() {
    const heroMuteBtn = document.getElementById('gotita-mute-btn');
    const companionMuteBtn = document.getElementById('companion-mute-btn');
    if (heroMuteBtn) {
      heroMuteBtn.innerHTML = isMuted ? '🔇 Silenciado' : '🔊 Sonido';
      heroMuteBtn.classList.toggle('is-muted', isMuted);
      heroMuteBtn.title = isMuted ? 'Activar sonido de Gotita' : 'Silenciar sonido de Gotita';
    }
    if (companionMuteBtn) {
      companionMuteBtn.innerHTML = isMuted ? '🔇' : '🔊';
      companionMuteBtn.classList.toggle('is-muted', isMuted);
      companionMuteBtn.title = isMuted ? 'Activar sonido de Gotita' : 'Silenciar sonido de Gotita';
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    try {
      localStorage.setItem('cloragua_gotita_muted', isMuted ? 'true' : 'false');
    } catch (e) {}
    updateMuteButtonsUI();
    if (isMuted) {
      setAllSpeech("¡Sonido de Gotita apagado! 🔇 Modo silencioso activado.");
    } else {
      setAllSpeech("¡Sonido de Gotita activado! 🔊 ¡Listo para interactuar!");
      playGotitaWaveSound();
    }
  }

  // Minimize / Expand logic
  if (dockToggle && companionWidget) {
    dockToggle.addEventListener('click', () => {
      companionWidget.classList.remove('minimized');
      jump();
    });
  }
  if (minimizeBtn && companionWidget) {
    minimizeBtn.addEventListener('click', () => {
      companionWidget.classList.add('minimized');
    });
  }

  // Bind Buttons
  const bindBtn = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };

  bindBtn('bgm-toggle-btn', toggleBgm);
  bindBtn('gotita-music-btn', toggleBgm);
  bindBtn('companion-music-btn', toggleBgm);

  bindBtn('gotita-mute-btn', toggleMute);
  bindBtn('companion-mute-btn', toggleMute);

  bindBtn('gotita-tickle-btn', tickle);
  bindBtn('companion-tickle-btn', tickle);

  bindBtn('gotita-wave-btn', () => {
    const p = wavePhrases[Math.floor(Math.random() * wavePhrases.length)];
    wave(p);
  });
  bindBtn('gotita-jump-btn', () => {
    const p = jumpPhrases[Math.floor(Math.random() * jumpPhrases.length)];
    jump(p);
  });
  bindBtn('gotita-spin-btn', () => {
    const p = spinPhrases[Math.floor(Math.random() * spinPhrases.length)];
    spin(p);
  });
  bindBtn('gotita-tip-btn', nextTip);

  bindBtn('companion-tip-btn', nextTip);
  bindBtn('companion-jump-btn', () => {
    const p = jumpPhrases[Math.floor(Math.random() * jumpPhrases.length)];
    jump(p);
  });
  bindBtn('companion-spin-btn', () => {
    const p = spinPhrases[Math.floor(Math.random() * spinPhrases.length)];
    spin(p);
  });
  bindBtn('companion-wave-btn', () => {
    const p = wavePhrases[Math.floor(Math.random() * wavePhrases.length)];
    wave(p);
  });

  // Initialize Mute and BGM UI state
  updateMuteButtonsUI();
  updateBgmButtonsUI();

  // Pointer Movement Tracking
  function onPointerMove(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Track relative to screen center for natural 3D parallax
    const relX = (clientX - window.innerWidth / 2) / (window.innerWidth / 2);
    const relY = (clientY - window.innerHeight / 2) / (window.innerHeight / 2);

    model.targetRotY = Math.max(-0.45, Math.min(0.45, relX * 0.45));
    model.targetRotX = Math.max(-0.35, Math.min(0.35, relY * 0.35));
    model.targetEyeX = Math.max(-1, Math.min(1, relX * 1.2));
    model.targetEyeY = Math.max(-1, Math.min(1, relY * 1.2));
  }
  window.addEventListener('mousemove', onPointerMove, { passive: true });
  window.addEventListener('touchmove', onPointerMove, { passive: true });

  // Direct Canvas Click / Tap triggers Cosquillas & Giggle Sound
  if (heroCanvas) heroCanvas.addEventListener('click', tickle);
  if (companionCanvas) companionCanvas.addEventListener('click', tickle);

  // Canvas Drawing Routine: 3D Gotita Water Droplet Mascot
  function drawGotitaInstance(canvas, ctx, scaleFactor = 1) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = rect.width * dpr;
    const targetH = rect.height * dpr;

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h * 0.48 + model.vy;

    // Draw realistic translucent ocean bubbles
    model.bubbles.forEach(b => {
      ctx.beginPath();
      const bx = (b.x % (w - 20)) + 10;
      const by = ((b.y + Math.sin(time + b.phase) * 8) % (h - 20)) + 10;
      ctx.arc(bx, by, b.r * scaleFactor, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(180, 240, 255, 0.4)';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.stroke();

      // Bubble specular highlight
      ctx.beginPath();
      ctx.arc(bx - b.r * 0.32 * scaleFactor, by - b.r * 0.32 * scaleFactor, b.r * 0.28 * scaleFactor, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fill();
    });

    // Draw splashes / water droplets
    model.splashes.forEach(p => {
      ctx.beginPath();
      ctx.arc(centerX + p.x * scaleFactor, centerY + p.y * scaleFactor, p.r * p.life * scaleFactor, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(92, 225, 230, ${p.life * 0.9})`;
      ctx.fill();
    });

    // Draw floating hearts, bubbles & sparkles
    model.hearts.forEach(h => {
      ctx.save();
      ctx.translate(centerX + h.x * scaleFactor, centerY + h.y * scaleFactor);
      ctx.rotate(h.rot);
      ctx.globalAlpha = Math.max(0, h.life);
      ctx.font = `${Math.round(h.size * scaleFactor)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h.symbol, 0, 0);
      ctx.restore();
    });

    // 3D Gotita Water Droplet Mascot
    ctx.save();
    ctx.translate(centerX, centerY);
    
    // Laugh flutter squish and rotation when tickled
    const tickleWobble = model.isTickled ? Math.sin(time * 40) * 0.08 : 0;
    const currentSquishX = model.squishX * (model.isTickled ? 1 + Math.sin(time * 32) * 0.09 : 1);
    const currentSquishY = model.squishY * (model.isTickled ? 1 - Math.sin(time * 32) * 0.09 : 1);

    ctx.scale(currentSquishX * scaleFactor, currentSquishY * scaleFactor);
    ctx.rotate(model.rotY * 0.35 + model.spinAngle + tickleWobble);

    // Left floating hand
    let leftArmX = -68 + Math.sin(time * 2) * 3;
    let leftArmY = 16 + Math.cos(time * 2) * 4;
    let leftHandAngle = 0;
    if (model.isTickled) {
      leftArmX = -72 + Math.sin(time * 35) * 5;
      leftArmY = 10 + Math.cos(time * 35) * 6;
      leftHandAngle = Math.sin(time * 30) * 0.4;
    }
    drawWaterHand(ctx, leftArmX, leftArmY, 14, false, leftHandAngle);

    // Right floating hand
    let rightArmX = 68 - Math.sin(time * 2) * 3;
    let rightArmY = 16 + Math.cos(time * 2) * 4;
    let rightHandWaveAngle = 0;
    if (model.isTickled) {
      rightArmX = 72 - Math.sin(time * 35) * 5;
      rightArmY = 10 + Math.cos(time * 35) * 6;
      rightHandWaveAngle = -Math.sin(time * 30) * 0.4;
    } else if (model.isWaving) {
      rightArmX = 72;
      rightArmY = -24 + Math.sin(model.wavePhase) * 6;
      rightHandWaveAngle = Math.sin(model.wavePhase * 1.5) * 0.6;
    }
    drawWaterHand(ctx, rightArmX, rightArmY, 14, true, rightHandWaveAngle);

    // Gotita Water Droplet Body
    ctx.beginPath();
    ctx.moveTo(0, -84);
    ctx.bezierCurveTo(30, -50, 70, -12, 70, 36);
    ctx.bezierCurveTo(70, 80, 40, 94, 0, 94);
    ctx.bezierCurveTo(-40, 94, -70, 80, -70, 36);
    ctx.bezierCurveTo(-70, -12, -30, -50, 0, -84);
    ctx.closePath();

    // Vibrant Crystal Water Gradient
    const bodyGrad = ctx.createRadialGradient(-18, -12, 10, 0, 20, 92);
    bodyGrad.addColorStop(0, '#7ee7ff');
    bodyGrad.addColorStop(0.3, '#38bdf8');
    bodyGrad.addColorStop(0.65, '#0284c7');
    bodyGrad.addColorStop(1, '#034078');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Internal Caustic Glow
    const causticGrad = ctx.createLinearGradient(0, 40, 0, 92);
    causticGrad.addColorStop(0, 'rgba(0, 255, 230, 0)');
    causticGrad.addColorStop(1, 'rgba(0, 255, 230, 0.45)');
    ctx.fillStyle = causticGrad;
    ctx.fill();

    // Rim Fresnel Glow
    ctx.lineWidth = 3.5;
    const rimGrad = ctx.createLinearGradient(-60, -60, 60, 60);
    rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    rimGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.6)');
    rimGrad.addColorStop(1, 'rgba(3, 64, 120, 0.4)');
    ctx.strokeStyle = rimGrad;
    ctx.stroke();

    // Top Crest Highlight
    ctx.beginPath();
    ctx.moveTo(-10, -76);
    ctx.bezierCurveTo(-2, -80, 2, -80, 10, -76);
    ctx.bezierCurveTo(4, -66, -4, -66, -10, -76);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();

    // Primary Specular Glint
    ctx.beginPath();
    ctx.ellipse(-24, -20, 16, 26, -Math.PI / 6, 0, Math.PI * 2);
    const specGrad = ctx.createRadialGradient(-28, -26, 2, -24, -20, 22);
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    specGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.65)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = specGrad;
    ctx.fill();

    // Secondary Specular Glint
    ctx.beginPath();
    ctx.arc(-34, 12, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fill();

    // 3D Cute Face
    const faceX = model.rotY * 26;
    const faceY = 12 + model.rotX * 18;
    ctx.save();
    ctx.translate(faceX, faceY);

    // Cheeks
    const cheekGlow = model.isTickled ? 'rgba(255, 42, 109, 0.8)' : 'rgba(255, 107, 139, 0.5)';
    const cheekRadius = model.isTickled ? 13 : 10.5;

    ctx.beginPath();
    ctx.arc(-36, 14, cheekRadius, 0, Math.PI * 2);
    ctx.fillStyle = cheekGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(36, 14, cheekRadius, 0, Math.PI * 2);
    ctx.fillStyle = cheekGlow;
    ctx.fill();

    if (model.isTickled) {
      // Extra cute sparkle highlights on cheeks when laughing
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-38, 11, 2.2, 0, Math.PI * 2);
      ctx.arc(38, 11, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes
    const eyeOffsetX = 22;
    const eyeY = 2;
    const eyeW = 9.5;
    const eyeH = 14;

    if (model.isHappy || model.isTickled) {
      drawHappyEye(ctx, -eyeOffsetX, eyeY);
      drawHappyEye(ctx, eyeOffsetX, eyeY);
    } else {
      drawEye(ctx, -eyeOffsetX, eyeY, eyeW, eyeH, model.eyeLookX, model.eyeLookY, model.blink);
      drawEye(ctx, eyeOffsetX, eyeY, eyeW, eyeH, model.eyeLookX, model.eyeLookY, model.blink);
    }

    // Mouth
    if (model.isTickled) {
      // Wide laughing open mouth with bouncing tongue
      ctx.beginPath();
      ctx.arc(0, 16, 14, 0.05 * Math.PI, 0.95 * Math.PI, false);
      ctx.closePath();
      ctx.fillStyle = '#9b111e';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 22 + Math.sin(time * 30) * 1.5, 8, 0, Math.PI, true);
      ctx.fillStyle = '#ff4d6d';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#023e8a';
      ctx.stroke();
    } else if (model.isHappy || model.isWaving) {
      ctx.beginPath();
      ctx.arc(0, 15, 12, 0.1 * Math.PI, 0.9 * Math.PI, false);
      ctx.closePath();
      ctx.fillStyle = '#9b111e';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 20, 6.5, 0, Math.PI, true);
      ctx.fillStyle = '#ff758f';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#023e8a';
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 10 + Math.sin(time * 2) * 0.5, 9, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.lineWidth = 3.0;
      ctx.strokeStyle = '#022d64';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
    ctx.restore();
  }

  function drawEye(ctx, x, y, w, h, lookX, lookY, blink) {
    ctx.save();
    ctx.translate(x, y);
    const currentH = Math.max(1, h * (1 - blink));

    ctx.beginPath();
    ctx.ellipse(0, 0, w, currentH, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#012a4a';
    ctx.stroke();

    if (currentH > 3) {
      const pupilX = lookX * 3.5;
      const pupilY = lookY * 2.5;
      const pupilR = 5.5;

      ctx.beginPath();
      ctx.arc(pupilX, pupilY, pupilR, 0, Math.PI * 2);
      ctx.fillStyle = '#012a4a';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pupilX, pupilY + 1.5, pupilR * 0.65, 0, Math.PI);
      ctx.fillStyle = '#00b4d8';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pupilX - 2, pupilY - 2, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pupilX + 2.2, pupilY + 2, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHappyEye(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 4, 9, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = '#012a4a';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawWaterHand(ctx, x, y, radius, isRight, waveAngle = 0) {
    ctx.save();
    ctx.translate(x, y);
    if (waveAngle !== 0) ctx.rotate(waveAngle);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    const handGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, radius);
    handGrad.addColorStop(0, '#5ce1e6');
    handGrad.addColorStop(0.6, '#00b4d8');
    handGrad.addColorStop(1, '#0077b6');
    ctx.fillStyle = handGrad;
    ctx.fill();

    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-4, -4, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();
    ctx.restore();
  }

  // Animation Loop
  let time = 0;
  const heroCtx = heroCanvas ? heroCanvas.getContext('2d') : null;
  const compCtx = companionCanvas ? companionCanvas.getContext('2d') : null;

  function renderLoop() {
    time += 0.035;

    // Bubbles flow
    model.bubbles.forEach(b => {
      b.y -= b.speed;
      if (b.y < -10) b.y = 180;
    });

    // Splashes physics
    for (let i = model.splashes.length - 1; i >= 0; i--) {
      const p = model.splashes[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22;
      p.life -= 0.035;
      if (p.life <= 0) model.splashes.splice(i, 1);
    }

    // Floating hearts / sparkles physics
    for (let i = model.hearts.length - 1; i >= 0; i--) {
      const h = model.hearts[i];
      h.x += h.vx;
      h.y += h.vy;
      h.vy *= 0.96;
      h.life -= 0.022;
      if (h.life <= 0) model.hearts.splice(i, 1);
    }

    // Vertical Jump / Float
    const idleY = Math.sin(time * 1.6) * 6;
    model.vy += 0.38; // gravity
    if (model.vy > 0 && model.vy >= idleY) {
      if (model.vy > 1.6) {
        model.squishX = 1 + Math.min(0.32, model.vy * 0.04);
        model.squishY = 1 - Math.min(0.32, model.vy * 0.04);
        createSplash(3);
      }
      model.vy = idleY;
    }

    // Spring damping
    model.squishVx += (1 - model.squishX) * 0.14;
    model.squishVx *= 0.78;
    model.squishX += model.squishVx;

    model.squishVy += (1 - model.squishY) * 0.14;
    model.squishVy *= 0.78;
    model.squishY += model.squishVy;

    // Smooth rotations & eye look
    model.rotX += (model.targetRotX - model.rotX) * 0.1;
    model.rotY += (model.targetRotY - model.rotY) * 0.1;
    model.eyeLookX += (model.targetEyeX - model.eyeLookX) * 0.14;
    model.eyeLookY += (model.targetEyeY - model.eyeLookY) * 0.14;

    // Spin
    if (model.spinSpeed > 0) {
      model.spinAngle += model.spinSpeed;
      if (model.spinAngle >= Math.PI * 2) {
        model.spinAngle = 0;
        model.spinSpeed = 0;
      }
    }

    // Blinking
    model.blinkTimer++;
    if (model.blinkTimer > 150 + Math.random() * 90) {
      model.blinkTarget = 1;
      model.blinkTimer = 0;
    }
    model.blink += (model.blinkTarget - model.blink) * 0.28;
    if (model.blink > 0.9) model.blinkTarget = 0;

    // Timers
    if (model.tickleTimer > 0) {
      model.tickleTimer--;
      model.isTickled = true;
    } else {
      model.isTickled = false;
    }

    if (model.happyTimer > 0) model.happyTimer--;
    else if (!model.isTickled) model.isHappy = false;

    if (model.waveTimer > 0) {
      model.waveTimer--;
      model.wavePhase += 0.25;
    } else {
      model.isWaving = false;
    }

    // Render on Hero Canvas if visible
    if (heroCanvas && heroCtx && currentPage === 'inicio') {
      drawGotitaInstance(heroCanvas, heroCtx, 1);
    }

    // Render on Global Companion Canvas
    if (companionCanvas && compCtx) {
      drawGotitaInstance(companionCanvas, compCtx, 0.72);
    }

    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);
})();

// =========================================================================
// MÓDULO DE APOYO TÉCNICO POR WHATSAPP (Teléfono: 920221581 / +51 920 221 581)
// =========================================================================
(() => {
  const WHATSAPP_PHONE = '51920221581';

  const WHATSAPP_TEMPLATES = {
    all: {
      title: 'Menú Completo de Opciones',
      body: `Buenos días , necesito ayuda en lo siguiente :

💧 *CLORAGUA - APOYO TÉCNICO & ASISTENCIA*
Solicito ayuda en las siguientes opciones de la plataforma web:

1️⃣ *Cálculo de Dosis de Cloro* (Hipoclorito de Sodio o Calcio)
2️⃣ *Volumen y Capacidad del Tanque* (Cilíndrico / Rectangular)
3️⃣ *Verificación de Cloro Residual Libre* (Comparador DPD en red)
4️⃣ *Calibración de Dosificador por Goteo* (mL/min o probeta)
5️⃣ *Preparación de Solución Madre y Dilución*
6️⃣ *Georreferenciación y Coordenadas UTM WGS84* (Google Maps)
7️⃣ *Registro y Padrón de Sistemas JASS*
8️⃣ *Normativa Sanitaria D.S. N.° 031-2010-SA*
9️⃣ *Otra consulta técnica u operativa*

🌐 _Mensaje enviado desde la plataforma web ClorAgua_`
    },
    dosis: {
      title: '1. Cálculo de Dosis de Cloro',
      body: `Buenos días , necesito ayuda en lo siguiente :

💧 *1. CÁLCULO DE DOSIS DE CLORO (CLORAGUA)*
Solicito asistencia técnica para el cálculo de desinfección:
• Tipo de producto: Hipoclorito de sodio / Calcio
• Volumen de agua a tratar (L o m³): 
• Cloro residual actual medido (mg/L): 
• Cloro residual objetivo (0.50 - 1.00 mg/L): 

🌐 _Enviado desde la plataforma web ClorAgua_`
    },
    volumen: {
      title: '2. Volumen del Tanque',
      body: `Buenos días , necesito ayuda en lo siguiente :

🚰 *2. CÁLCULO DE VOLUMEN DE TANQUE / RESERVORIO*
Solicito apoyo para calcular la capacidad y nivel de agua:
• Geometría: Tanque cilíndrico / rectangular
• Dimensiones principales: 

🌐 _Enviado desde la plataforma web ClorAgua_`
    },
    verificar: {
      title: '3. Verificación de Cloro Residual',
      body: `Buenos días , necesito ayuda en lo siguiente :

🧪 *3. CONTROL Y VIGILANCIA DE CLORO RESIDUAL (DPD)*
Solicito orientación sobre mediciones de campo y cumplimiento normativo:
• Punto de toma: Reservorio / Primera vivienda / Extremo de red
• Valor medido con comparador DPD (mg/L): 

🌐 _Enviado desde la plataforma web ClorAgua_`
    },
    calibrar: {
      title: '4. Calibración de Dosificador',
      body: `Buenos días , necesito ayuda en lo siguiente :

⏱️ *4. CALIBRACIÓN DE DOSIFICADOR POR GOTEO*
Solicito apoyo para calibrar el caudal de solución clorada:
• Caudal de ingreso de agua al reservorio (L/s): 
• Concentración de solución en tanque (%): 
• Caudal de goteo calibrado (mL/min): 

🌐 _Enviado desde la plataforma web ClorAgua_`
    },
    solucion: {
      title: '5. Preparación de Solución Madre',
      body: `Buenos días , necesito ayuda en lo siguiente :

🥣 *5. PREPARACIÓN DE SOLUCIÓN MADRE*
Solicito cálculo de dilución y cantidad de hipoclorito para el tanque de solución.

🌐 _Enviado desde la plataforma web ClorAgua_`
    },
    utm: {
      title: '6. Coordenadas UTM y GPS',
      body: `Buenos días , necesito ayuda en lo siguiente :

🗺️ *6. GEORREFERENCIACIÓN Y COORDENADAS UTM WGS84*
Solicito asistencia para ubicar y transformar coordenadas de captaciones o reservorios desde Google Maps.

🌐 _Enviado desde la plataforma web ClorAgua_`
    },
    sistemas: {
      title: '7. Registro de Sistemas JASS',
      body: `Buenos días , necesito ayuda en lo siguiente :

📊 *7. REGISTRO Y GESTIÓN DE SISTEMAS JASS*
Solicito apoyo con la administración de sistemas de agua rural y padrón de infraestructura.

🌐 _Enviado desde la plataforma web ClorAgua_`
    },
    normativa: {
      title: '8. Normativa D.S. 031-2010-SA',
      body: `Buenos días , necesito ayuda en lo siguiente :

📑 *8. NORMATIVA Y PARÁMETROS SANITARIOS (D.S. 031-2010-SA)*
Solicito información sobre el marco normativo de calidad de agua para consumo humano.

🌐 _Enviado desde la plataforma web ClorAgua_`
    },
    otro: {
      title: '9. Otra Consulta / Soporte General',
      body: `Buenos días , necesito ayuda en lo siguiente :

💬 *9. CONSULTA GENERAL - APOYO TÉCNICO CLORAGUA*
Estimado especialista técnico, tengo una consulta sobre el uso de la plataforma web:

🌐 _Enviado desde la plataforma web ClorAgua_`
    }
  };

  let selectedOption = 'all';

  function buildMessage() {
    const template = WHATSAPP_TEMPLATES[selectedOption] || WHATSAPP_TEMPLATES.all;
    let baseText = template.body;
    const noteInput = document.getElementById('whatsapp-custom-note');
    const note = noteInput ? noteInput.value.trim() : '';

    if (note) {
      baseText += `\n\n📌 *Detalle específico de la consulta:*\n"${note}"`;
    }
    return baseText;
  }

  function updatePreview() {
    const preview = document.getElementById('whatsapp-preview-text');
    if (preview) {
      preview.value = buildMessage();
    }
  }

  function openWhatsAppModal() {
    const modal = document.getElementById('whatsapp-support-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    updatePreview();
    if (window.gotitaReact) {
      window.gotitaReact('¡Apoyo Técnico disponible! Puedes escribirnos directamente por WhatsApp al 920 221 581 📱💧');
    }
  }

  function closeWhatsAppModal() {
    const modal = document.getElementById('whatsapp-support-modal');
    if (modal) modal.classList.add('hidden');
  }

  function sendToWhatsApp() {
    const message = buildMessage();
    const encoded = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encoded}`;
    
    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    
    toast('Abriendo WhatsApp con Apoyo Técnico (+51 920 221 581)...');
    if (window.gotitaReact) {
      window.gotitaReact('¡Mensaje enviado a WhatsApp! En breve nuestro equipo técnico te responderá 💧✨');
    }
    closeWhatsAppModal();
  }

  // Bind Buttons & Events
  const supportCard = document.getElementById('sidebar-support-card');
  if (supportCard) supportCard.onclick = openWhatsAppModal;

  const sidebarWaBtn = document.getElementById('sidebar-whatsapp-btn');
  if (sidebarWaBtn) {
    sidebarWaBtn.onclick = (e) => {
      e.stopPropagation();
      openWhatsAppModal();
    };
  }

  const headerCotizarBtn = document.getElementById('header-cotizar-btn');
  if (headerCotizarBtn) headerCotizarBtn.onclick = openWhatsAppModal;

  const heroWaBtn = document.getElementById('hero-whatsapp-btn');
  if (heroWaBtn) heroWaBtn.onclick = openWhatsAppModal;

  const serviceWaBtn = document.getElementById('service-card-soporte-wa');
  if (serviceWaBtn) serviceWaBtn.onclick = openWhatsAppModal;

  const normativaWaBtn = document.getElementById('normativa-whatsapp-btn');
  if (normativaWaBtn) normativaWaBtn.onclick = openWhatsAppModal;

  const volumeWaBtn = document.getElementById('volume-consult-wa-btn');
  if (volumeWaBtn) volumeWaBtn.onclick = openWhatsAppModal;

  // Header help button
  const helpBtn = document.querySelector('header .help');
  if (helpBtn) helpBtn.onclick = openWhatsAppModal;

  // Live HUD Sine Wave Telemetry Animation
  (function initHudWave() {
    const hudCanvas = document.getElementById('hud-telemetry-canvas');
    if (!hudCanvas) return;
    const ctx = hudCanvas.getContext('2d');
    if (!ctx) return;

    let offset = 0;
    function drawWave() {
      const w = hudCanvas.width;
      const h = hudCanvas.height;
      ctx.clearRect(0, 0, w, h);

      // Gradient stroke
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.2)');
      grad.addColorStop(0.5, 'rgba(0, 229, 255, 0.95)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0.3)');

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = grad;

      const midY = h / 2;
      for (let x = 0; x < w; x++) {
        const y = midY + Math.sin((x * 0.05) + offset) * 10 + Math.cos((x * 0.02) - offset * 0.5) * 4;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      offset += 0.06;
      requestAnimationFrame(drawWave);
    }
    drawWave();
  })();

  // Close buttons
  const closeBtn = document.getElementById('close-whatsapp-modal-btn');
  if (closeBtn) closeBtn.onclick = closeWhatsAppModal;

  const closeBottomBtn = document.getElementById('close-whatsapp-modal-bottom-btn');
  if (closeBottomBtn) closeBottomBtn.onclick = closeWhatsAppModal;

  // Backdrop click to close
  const modalBackdrop = document.getElementById('whatsapp-support-modal');
  if (modalBackdrop) {
    modalBackdrop.onclick = (e) => {
      if (e.target === modalBackdrop) closeWhatsAppModal();
    };
  }

  // Option buttons
  const optionButtons = document.querySelectorAll('.wa-opt-btn');
  optionButtons.forEach(btn => {
    btn.onclick = () => {
      optionButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedOption = btn.dataset.option || 'all';
      updatePreview();
    };
  });

  // Custom note input live sync
  const noteInput = document.getElementById('whatsapp-custom-note');
  if (noteInput) {
    noteInput.addEventListener('input', updatePreview);
  }

  // Copy button
  const copyBtn = document.getElementById('whatsapp-copy-btn');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      const text = buildMessage();
      try {
        await navigator.clipboard.writeText(text);
        toast('¡Texto copiado al portapapeles!');
      } catch (err) {
        toast('No se pudo copiar automáticamente.');
      }
    };
  }

  // Send Direct Button
  const sendBtn = document.getElementById('send-whatsapp-direct-btn');
  if (sendBtn) {
    sendBtn.onclick = sendToWhatsApp;
  }
})();



/* ============================================================
   SCRIPT.JS — Intelicob v3.2
   Analista: só console de atendimento (busca por CPF/nome)
   Gerente: acesso total + exclusão funcional
   ============================================================ */

// ============================================================
//  AUTH & RBAC
// ============================================================
let currentUser = null;

function getPermissions() {
  if (!currentUser) return null;
  return CONFIG.RBAC[currentUser.role] ?? null;
}
function can(action) {
  const p = getPermissions();
  return p ? !!p[action] : false;
}
function isLogged() { return !!currentUser; }

function saveSession(user) {
  currentUser = user;
  sessionStorage.setItem('credi_user', JSON.stringify(user));
}
function loadSession() {
  const raw = sessionStorage.getItem('credi_user');
  if (raw) { try { currentUser = JSON.parse(raw); } catch { currentUser = null; } }
}
function logout() {
  currentUser = null;
  sessionStorage.removeItem('credi_user');
  showLoginScreen();
}

// Aplica RBAC assim que o usuário entra
function applyRBAC() {
  if (!currentUser) return;
  const isGerente = currentUser.role === 'GERENTE';

  // Aba Dashboard — só gerente vê
  const dashTab = document.querySelector('.nav-tab[data-view="dashboard"]');
  if (dashTab) dashTab.style.display = isGerente ? '' : 'none';

  // Aba Cadastros — só gerente vê
  const cadTab = document.querySelector('.nav-tab[data-view="cadastros"]');
  if (cadTab) cadTab.style.display = isGerente ? '' : 'none';

  // Botão Novo Cliente — só gerente
  const btnNovo = document.getElementById('btn-novo-cliente');
  if (btnNovo) btnNovo.style.display = isGerente ? '' : 'none';

  // Atualiza info do usuário no header
  updateUserInfo();
}

function updateUserInfo() {
  const wrap = document.getElementById('user-info-wrap');
  if (!wrap || !currentUser) return;
  const ri = roleInfo(currentUser.role);

  wrap.innerHTML = '';

  const pill = document.createElement('span');
  pill.className = 'user-info-pill';
  pill.textContent = `${ri.icon} ${currentUser.nome} (${ri.label})`;

  const btn = document.createElement('button');
  btn.className = 'btn-logout';
  btn.textContent = 'Sair';
  btn.addEventListener('click', logout);

  wrap.appendChild(pill);
  wrap.appendChild(btn);
}

// ============================================================
//  LOGIN SCREEN
// ============================================================
function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-root').classList.add('hidden');
  document.getElementById('login-email').value = '';
  document.getElementById('login-senha').value = '';
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-root').classList.remove('hidden');
  applyRBAC();
  // Analista vai direto para atendimento e fica lá
  if (currentUser?.role !== 'GERENTE') {
    switchViewInternal('atendimento');
  }
}

async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  if (!email || !senha) { toast('Preencha e-mail e senha.', 'error'); return; }

  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Entrando...';

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.USUARIO_LOGIN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.erro || 'Credenciais inválidas.');
    }
    const user = await res.json();
    saveSession(user);
    toast(`✅ Bem-vindo, ${user.nome}!`, 'success');
    showApp();
  } catch (err) {
    // Fallback demo offline
    if (email === 'gerente@intelicob.com' && senha === '123456') {
      saveSession({ id: 1, nome: 'Bruna Mendes', email, role: 'GERENTE' });
      toast('⚠️ Demo offline — modo gerente.', 'info', 3000);
      showApp();
    } else if (email === 'analista@intelicob.com' && senha === '123456') {
      saveSession({ id: 2, nome: 'Marcos Oliveira', email, role: 'ANALISTA' });
      toast('⚠️ Demo offline — modo analista.', 'info', 3000);
      showApp();
    } else {
      toast(`❌ ${err.message}`, 'error');
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

// ============================================================
//  API LAYER
// ============================================================
const API = (() => {
  const BASE = CONFIG.API_BASE_URL;
  async function request(path, { method = 'GET', body, raw = false } = {}) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = `Erro ${res.status}`;
      try {
        const j = JSON.parse(text);
        if (j.mensagem) msg = j.mensagem;
        else if (j.erro) msg = j.erro;
        else if (j.message) msg = j.message;
        else if (j.errors?.length) msg = j.errors.map(e => e.defaultMessage || e.message).join('; ');
      } catch {}
      throw new Error(msg);
    }
    // raw=true: retorna o blob para download (boleto, PDF, etc.)
    if (raw) {
      const blob = await res.blob();
      const filename = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g,'') || 'download.txt';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      return null;
    }
    if (res.status === 204) return null;
    return res.text().then(t => { try { return JSON.parse(t); } catch { return null; } });
  }
  return {
    listarClientes:      () => request(CONFIG.ENDPOINTS.CLIENTES),
    buscarCliente:       (id) => request(CONFIG.ENDPOINTS.CLIENTE_BY_ID(id)),
    buscarPorTermo:      (q) => request(`${CONFIG.ENDPOINTS.CLIENTES}/buscar?q=${encodeURIComponent(q)}`),
    criarCliente:        (d) => request(CONFIG.ENDPOINTS.CLIENTES, { method:'POST', body:d }),
    atualizarCliente:    (id,d) => request(CONFIG.ENDPOINTS.CLIENTE_BY_ID(id), { method:'PUT', body:d }),
    deletarCliente:      (id) => request(CONFIG.ENDPOINTS.CLIENTE_BY_ID(id), { method:'DELETE' }),
    listarCobrancas:     (p=0,s=50) => request(`${CONFIG.ENDPOINTS.COBRANCAS}?page=${p}&size=${s}`),
    buscarCobranca:      (id) => request(CONFIG.ENDPOINTS.COBRANCA_BY_ID(id)),
    criarCobranca:       (d) => request(CONFIG.ENDPOINTS.COBRANCAS, { method:'POST', body:d }),
    atualizarCobranca:   (id,d) => request(CONFIG.ENDPOINTS.COBRANCA_BY_ID(id), { method:'PUT', body:d }),
    cobrancasPorCliente: (id) => request(CONFIG.ENDPOINTS.COBRANCA_POR_CLIENTE(id)),
    gerarBoleto:         (id) => request(CONFIG.ENDPOINTS.BOLETO_POR_COBRANCA(id), { method:'GET', raw:true }),
    gerarBoletoConsolidado: (cod) => request(CONFIG.ENDPOINTS.BOLETO_CONSOLIDADO(cod), { method:'GET', raw:true }),
    registrarAcordo:     (id, dados) => request(CONFIG.ENDPOINTS.REGISTRAR_ACORDO(id), { method:'POST', body:dados }),
    dashboard:           () => request(CONFIG.ENDPOINTS.DASHBOARD),
    criarOcorrencia:     (cid,d) => request(CONFIG.ENDPOINTS.OCORRENCIA_CRIAR(cid), { method:'POST', body:d }),
    listarOcorrencias:     (cid) => request(CONFIG.ENDPOINTS.OCORRENCIA_LISTAR(cid)),
    ocorrenciasPorCliente: (cid) => request(CONFIG.ENDPOINTS.OCORRENCIA_LISTAR(cid)),
    ocorrenciasRecentes: () => request(CONFIG.ENDPOINTS.OCORRENCIAS_RECENTES),
  };
})();

// ============================================================
//  HELPERS
// ============================================================
function toast(msg, type='info', dur=3500) {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`; el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => {
    el.style.opacity='0'; el.style.transform='translateY(20px)'; el.style.transition='all .3s';
    setTimeout(() => el.remove(), 300);
  }, dur);
}
function showStatus(msg, type='info') {
  const b = document.getElementById('status-banner');
  b.textContent = msg; b.className = `status-banner ${type}`;
  b.classList.remove('hidden');
}
function hideStatus() { document.getElementById('status-banner').classList.add('hidden'); }

// openModal: footer recebe array de { label, class, onClick }
function openModal(title, bodyHTML, footerConfig) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;

  const footerEl = document.getElementById('modal-footer');
  footerEl.innerHTML = '';
  if (Array.isArray(footerConfig)) {
    footerConfig.forEach(cfg => {
      const b = document.createElement('button');
      b.className = cfg.class || 'btn-ghost';
      b.textContent = cfg.label;
      b.addEventListener('click', cfg.onClick);
      footerEl.appendChild(b);
    });
  }
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }
function esc(s) { const d = document.createElement('div'); d.textContent = String(s ?? '—'); return d.innerHTML; }
function statusBadge(info) {
  return `<span class="status-badge" style="background:${info.color}22;color:${info.color};border:1px solid ${info.color}44">${info.icon} ${info.label}</span>`;
}
function showFieldError(f, m) { const e = document.getElementById(`err-${f}`); if (e) { e.textContent = m; e.classList.remove('hidden'); } }
function clearErrors(prefix) { document.querySelectorAll(`[id^="err-${prefix}"]`).forEach(e => { e.textContent = ''; e.classList.add('hidden'); }); }
function fillSelect(elId, enumArr, placeholder='Selecione...') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `<option value="">${placeholder}</option>` +
    enumArr.map(o => `<option value="${o.value}">${o.icon} ${o.label}</option>`).join('');
}

// ============================================================
//  NAVEGAÇÃO — com RBAC
// ============================================================
function switchView(name) {
  // Bloqueia analista na dashboard e cadastros
  if (name === 'dashboard' && !can('canViewDashboard')) {
    toast('⛔ Acesso restrito a gerentes.', 'error'); return;
  }
  if (name === 'cadastros' && !can('canViewCadastros')) {
    toast('⛔ Acesso restrito a gerentes.', 'error'); return;
  }
  switchViewInternal(name);
}

function switchViewInternal(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`.nav-tab[data-view="${name}"]`);
  if (tab) tab.classList.add('active');
  if (name === 'dashboard') loadDashboard();
  if (name === 'cadastros') loadClientesLista();
}

function switchInnerTab(name) {
  document.querySelectorAll('.inner-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.inner-tab[data-inner="${name}"]`).classList.add('active');
  document.querySelectorAll('.inner-view').forEach(v => v.classList.remove('active'));
  document.getElementById(`inner-${name}`).classList.add('active');
}

// ============================================================
//  CONSOLE DE ATENDIMENTO — BUSCA
// ============================================================
let allClientes = [];
let currentCliente = null;
let currentCobrancas = [];
let currentOcorrencias = [];

// Debounce para autocomplete
let _searchTimer = null;
function debounce(fn, ms) {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(fn, ms);
}

async function buscarClienteConsole() {
  const query = document.getElementById('search-cpf').value.trim();
  if (!query) { toast('Digite um CPF/CNPJ ou nome para buscar.', 'error'); return; }
  if (query.length < 2) { toast('Digite ao menos 2 caracteres.', 'error'); return; }

  showStatus('🔍 Buscando cliente...', 'info');
  document.getElementById('cliente-card').classList.add('hidden');
  document.getElementById('empty-attendance').classList.remove('hidden');
  document.getElementById('empty-attendance').innerHTML = `
    <div class="empty-attendance-icon">⏳</div>
    <p class="empty-attendance-title">Buscando...</p>`;

  try {
    // Tenta endpoint de busca backend; fallback para lista local
    let found = [];
    try {
      found = await API.buscarPorTermo(query);
    } catch {
      // Fallback: filtra lista em memória
      if (allClientes.length === 0) allClientes = await API.listarClientes();
      const q = query.toLowerCase().replace(/[.\-\/]/g, '');
      found = allClientes.filter(c => {
        const nome = (c.nome || '').toLowerCase();
        const cpf = (c.cpfCnpj || '').replace(/[.\-\/]/g, '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        return nome.includes(query.toLowerCase()) || cpf.includes(q) || email.includes(query.toLowerCase());
      });
    }

    if (found.length === 0) {
      showStatus('❌ Nenhum cliente encontrado.', 'error');
      document.getElementById('empty-attendance').innerHTML = `
        <div class="empty-attendance-icon">🔍</div>
        <p class="empty-attendance-title">Nenhum cliente encontrado</p>
        <p class="empty-attendance-sub">Verifique o CPF/CNPJ ou nome digitado e tente novamente.</p>`;
      return;
    }

    hideStatus();
    if (found.length === 1) {
      await abrirClienteNoConsole(found[0].id);
    } else {
      mostrarMultiplosResultados(found);
    }
  } catch (err) {
    const isCors = err.message.includes('Failed to fetch') || err.message.includes('NetworkError');
    showStatus(isCors ? '⚠️ API não conecta. Spring Boot em localhost:8080?' : `❌ ${err.message}`, 'error');
    document.getElementById('empty-attendance').innerHTML = `
      <div class="empty-attendance-icon">⚠️</div>
      <p class="empty-attendance-title">Erro de conexão</p>
      <p class="empty-attendance-sub">${esc(err.message)}</p>`;
  }
}

function mostrarMultiplosResultados(resultados) {
  document.getElementById('cliente-card').classList.add('hidden');
  const empty = document.getElementById('empty-attendance');
  empty.classList.remove('hidden');

  const list = document.createElement('div');
  list.className = 'multi-result-list';

  resultados.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'multi-result-item';
    btn.addEventListener('click', () => abrirClienteNoConsole(c.id));

    const avatar = document.createElement('span');
    avatar.className = 'multi-result-avatar'; avatar.textContent = '👤';

    const info = document.createElement('span');
    info.className = 'multi-result-info';
    const strong = document.createElement('strong'); strong.textContent = c.nome;
    const small = document.createElement('small'); small.textContent = `${c.cpfCnpj || '—'} • ${c.email}`;
    info.appendChild(strong); info.appendChild(small);

    const badge = document.createElement('span');
    badge.innerHTML = statusBadge(statusClienteInfo(c.status));

    btn.appendChild(avatar); btn.appendChild(info); btn.appendChild(badge);
    list.appendChild(btn);
  });

  empty.innerHTML = '';
  const icon = document.createElement('div'); icon.className = 'empty-attendance-icon'; icon.textContent = '👥';
  const title = document.createElement('p'); title.className = 'empty-attendance-title';
  title.textContent = `${resultados.length} clientes encontrados`;
  const sub = document.createElement('p'); sub.className = 'empty-attendance-sub';
  sub.textContent = 'Selecione um para abrir o atendimento:';

  empty.appendChild(icon); empty.appendChild(title); empty.appendChild(sub); empty.appendChild(list);
}

async function abrirClienteNoConsole(id) {
  showStatus('🔄 Carregando dados do cliente...', 'info');
  document.getElementById('empty-attendance').classList.add('hidden');

  try {
    const cliente = await API.buscarCliente(id);
    currentCliente = cliente;

    const [cobRes, ocRes] = await Promise.allSettled([
      API.cobrancasPorCliente(id),
      API.listarOcorrencias(id),
    ]);
    currentCobrancas = cobRes.status === 'fulfilled' ? (cobRes.value || []) : [];
    currentOcorrencias = ocRes.status === 'fulfilled' ? (ocRes.value || []) : [];

    hideStatus();
    document.getElementById('cliente-card').classList.remove('hidden');

    renderClienteHeader(cliente);
    renderResumo(currentCobrancas, currentOcorrencias, cliente);
    renderCobrancasCliente(currentCobrancas);
    renderOcorrenciasCliente(currentOcorrencias);
    renderNegociacao(currentCobrancas);
    renderAcordos(currentCobrancas);
    initNegociacaoButtons();
    renderEditForm(cliente);

    fillSelect('oc-tipo', CONFIG.TIPO_OCORRENCIA, 'Selecione o tipo...');
    fillSelect('oc-resultado', CONFIG.RESULTADO_OCORRENCIA, 'Selecione o resultado...');

    switchInnerTab('resumo');
    document.getElementById('cliente-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showStatus(`❌ ${err.message}`, 'error');
    document.getElementById('empty-attendance').classList.remove('hidden');
    document.getElementById('empty-attendance').innerHTML = `
      <div class="empty-attendance-icon">⚠️</div>
      <p class="empty-attendance-title">Erro ao carregar cliente</p>
      <p class="empty-attendance-sub">${esc(err.message)}</p>`;
  }
}

function renderClienteHeader(c) {
  document.getElementById('cliente-avatar').textContent = '👤';
  document.getElementById('cliente-nome').textContent = c.nome;
  document.getElementById('cliente-cpf').textContent = c.cpfCnpj || '—';
  document.getElementById('cliente-email').textContent = c.email;
  document.getElementById('cliente-telefone').textContent = c.telephone || c.telefone || '—';
  document.getElementById('cliente-status-wrap').innerHTML = statusBadge(statusClienteInfo(c.status));
}

function renderResumo(cobrancas, ocorrencias, cliente) {
  const totalDebito = cobrancas.filter(c => c.status !== 'PAGO').reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalPago = cobrancas.filter(c => c.status === 'PAGO').reduce((s, c) => s + Number(c.valor || 0), 0);
  const ativas = cobrancas.filter(c => c.status !== 'PAGO').length;

  document.getElementById('resumo-total-debito').textContent = formatCurrency(totalDebito);
  document.getElementById('resumo-total-pago').textContent = formatCurrency(totalPago);
  document.getElementById('resumo-cobrancas-ativas').textContent = ativas;
  document.getElementById('resumo-total-ocorrencias').textContent = ocorrencias.length;

  const dadosEl = document.getElementById('resumo-dados-pessoais');
  dadosEl.innerHTML = `
    <div class="dados-grid">
      <div><span class="dados-label">CPF/CNPJ</span><span class="dados-value">${esc(cliente.cpfCnpj || '—')}</span></div>
      <div><span class="dados-label">Telefone</span><span class="dados-value">${esc(cliente.telephone || cliente.telefone || '—')}</span></div>
      <div><span class="dados-label">WhatsApp</span><span class="dados-value">${esc(cliente.whatsapp || '—')}</span></div>
      <div><span class="dados-label">Nascimento</span><span class="dados-value">${formatDate(cliente.dataNascimento)}</span></div>
      <div><span class="dados-label">Renda</span><span class="dados-value">${cliente.rendaPresumida ? formatCurrency(cliente.rendaPresumida) : '—'}</span></div>
      <div><span class="dados-label">Status</span><span class="dados-value">${statusBadge(statusClienteInfo(cliente.status))}</span></div>
    </div>
    <div class="dados-endereco">
      <p class="dados-section-title">📍 Endereço</p>
      <p>${esc(cliente.logradouro || '—')}, ${esc(cliente.numeroEndereco || 'S/N')} ${cliente.complemento ? '— ' + esc(cliente.complemento) : ''}</p>
      <p>${esc(cliente.bairro || '—')} — ${esc(cliente.cidade || '—')}/${esc(cliente.uf || '—')} — CEP: ${esc(cliente.cep || '—')}</p>
    </div>`;

  const ocEl = document.getElementById('resumo-ocorrencias');
  if (!ocorrencias?.length) { ocEl.innerHTML = '<p class="empty-state">Nenhuma ocorrência.</p>'; }
  else {
    ocEl.innerHTML = ocorrencias.slice(0, 3).map(o => {
      const tInfo = tipoOcorrenciaInfo(o.tipoOcorrencia);
      return `<div class="oc-item">
        <div class="oc-item-header"><span>${tInfo.icon} ${tInfo.label}</span><span>${formatDateTime(o.dataRegistro)}</span></div>
        <div class="oc-item-desc">${esc(o.descricao)}</div>
      </div>`;
    }).join('');
  }
}

function renderCobrancasCliente(cobrancas) {
  const el = document.getElementById('cliente-cobrancas-list');
  if (!cobrancas?.length) { el.innerHTML = '<p class="empty-state">Nenhuma cobrança registrada.</p>'; return; }
  el.innerHTML = cobrancas.map(c => {
    const sInfo = statusCobrancaInfo(c.status);
    const temParcelamento = c.parcelado && c.numeroParcelas;
    const parcTag = temParcelamento
      ? `<div class="cobranca-parc-tag">🗓️ ${esc(c.parcelaAtual||1)}/${esc(c.numeroParcelas)}x ${formatCurrency(c.valorParcela)} — ${formaPagamentoInfo(c.formaParcelamento||c.formaPagamento).icon} ${formaPagamentoInfo(c.formaParcelamento||c.formaPagamento).label}</div>`
      : '';
    return `<div class="cobranca-item">
      <div class="cobranca-item-header">
        <span class="cobranca-item-desc">${esc(c.descricao)}</span>
        ${statusBadge(sInfo)}
      </div>
      <div class="cobranca-item-details">
        <span>💰 ${formatCurrency(c.valor)}</span>
        <span>📅 Venc.: ${formatDate(c.dataVencimento)}</span>
        ${c.empresaCredora ? `<span>🏢 ${esc(c.empresaCredora)}</span>` : ''}
        ${c.formaPagamento && !temParcelamento ? `<span>${formaPagamentoInfo(c.formaPagamento).icon} ${formaPagamentoInfo(c.formaPagamento).label}</span>` : ''}
      </div>
      ${parcTag}
      ${c.observacoes ? `<div class="cobranca-obs">📝 ${esc(c.observacoes)}</div>` : ''}
      <div class="cobranca-item-actions">
        <button class="action-btn" onclick="editCobranca(${c.id})" title="Editar">✏️ Editar</button>
        <button class="action-btn action-btn-parc" onclick="showParcelamentoForm(${c.id})" title="Parcelar">🗓️ Parcelar</button>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
//  COBRANÇAS — MODAL
// ============================================================
function showCobrancaForm(cobranca=null) {
  const isEdit = !!cobranca;
  const body = `
    <div class="form-row">
      <div class="form-group"><label>Nº do Contrato</label><input type="text" id="form-cob-contrato" value="${esc(cobranca?.numeroContrato || '')}" placeholder="Ex: 2024-00123"></div>
      <div class="form-group"><label>Empresa Credora *</label><input type="text" id="form-cob-empresa" value="${esc(cobranca?.empresaCredora || '')}" maxlength="100"><div class="form-error hidden" id="err-cob-empresa"></div></div>
    </div>
    <div class="form-group"><label>Descrição *</label><textarea id="form-cob-descricao" rows="2" maxlength="255">${esc(cobranca?.descricao || '')}</textarea><div class="form-error hidden" id="err-cob-descricao"></div></div>
    <div class="form-row">
      <div class="form-group"><label>Categoria</label>
        <select id="form-cob-categoria"><option value="">Selecione...</option>${CONFIG.CATEGORIAS_DEBITO.map(cat => `<option value="${cat}" ${cobranca?.categoriaDebito === cat ? 'selected' : ''}>${cat}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Status *</label>
        <select id="form-cob-status">${CONFIG.STATUS_COBRANCA.map(s => `<option value="${s.value}" ${cobranca?.status === s.value ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Valor Atual *</label><input type="number" id="form-cob-valor" step="0.01" min="0.01" value="${cobranca?.valor ?? ''}"><div class="form-error hidden" id="err-cob-valor"></div></div>
      <div class="form-group"><label>Valor Original</label><input type="number" id="form-cob-valor-original" step="0.01" min="0" value="${cobranca?.valorOriginal ?? ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Multa (R$)</label><input type="number" id="form-cob-multa" step="0.01" min="0" value="${cobranca?.valorMulta ?? ''}"></div>
      <div class="form-group"><label>Juros (R$)</label><input type="number" id="form-cob-juros" step="0.01" min="0" value="${cobranca?.valorJuros ?? ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Vencimento *</label><input type="date" id="form-cob-vencimento" value="${cobranca?.dataVencimento || ''}"><div class="form-error hidden" id="err-cob-vencimento"></div></div>
      <div class="form-group"><label>Forma de Pagamento</label>
        <select id="form-cob-forma-pag"><option value="">Selecione...</option>${CONFIG.FORMA_PAGAMENTO.map(f => `<option value="${f.value}" ${cobranca?.formaPagamento === f.value ? 'selected' : ''}>${f.icon} ${f.label}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Código do Acordo</label><input type="text" id="form-cob-acordo" value="${esc(cobranca?.codigoAcordo || '')}"></div>
      <div class="form-group"><label>Data de Pagamento</label><input type="date" id="form-cob-data-pag" value="${cobranca?.dataPagamento || ''}"></div>
    </div>
    <div class="form-group"><label>Observações</label><textarea id="form-cob-obs" rows="2" maxlength="500">${esc(cobranca?.observacoes || '')}</textarea></div>`;

  openModal(isEdit ? 'Negociar / Editar Cobrança' : 'Nova Cobrança', body, [
    { label: 'Cancelar', class: 'btn-ghost', onClick: closeModal },
    { label: isEdit ? '💾 Salvar' : '➕ Criar', class: 'btn-primary', onClick: () => saveCobranca(cobranca?.id ?? null) },
  ]);
}

async function saveCobranca(id) {
  clearErrors('cob-');
  const data = {
    numeroContrato: document.getElementById('form-cob-contrato').value.trim() || null,
    empresaCredora: document.getElementById('form-cob-empresa').value.trim(),
    descricao: document.getElementById('form-cob-descricao').value.trim(),
    categoriaDebito: document.getElementById('form-cob-categoria').value || null,
    status: document.getElementById('form-cob-status').value,
    valor: parseFloat(document.getElementById('form-cob-valor').value),
    valorOriginal: parseFloat(document.getElementById('form-cob-valor-original').value) || null,
    valorMulta: parseFloat(document.getElementById('form-cob-multa').value) || null,
    valorJuros: parseFloat(document.getElementById('form-cob-juros').value) || null,
    dataVencimento: document.getElementById('form-cob-vencimento').value || null,
    formaPagamento: document.getElementById('form-cob-forma-pag').value || null,
    codigoAcordo: document.getElementById('form-cob-acordo').value.trim() || null,
    dataPagamento: document.getElementById('form-cob-data-pag').value || null,
    observacoes: document.getElementById('form-cob-obs').value.trim() || null,
    cliente: { id: currentCliente.id },
  };

  let hasError = false;
  if (!data.empresaCredora) { showFieldError('cob-empresa', 'Obrigatório'); hasError = true; }
  if (data.descricao.length < 5) { showFieldError('cob-descricao', 'Mínimo 5 caracteres'); hasError = true; }
  if (!data.valor || data.valor <= 0) { showFieldError('cob-valor', 'Valor deve ser maior que zero'); hasError = true; }
  if (!data.dataVencimento) { showFieldError('cob-vencimento', 'Vencimento obrigatório'); hasError = true; }
  if (hasError) return;

  try {
    if (id) { await API.atualizarCobranca(id, data); toast('✅ Cobrança atualizada!', 'success'); }
    else    { await API.criarCobranca(data); toast('✅ Cobrança criada!', 'success'); }
    closeModal();
    currentCobrancas = await API.cobrancasPorCliente(currentCliente.id);
    renderCobrancasCliente(currentCobrancas);
    renderResumo(currentCobrancas, currentOcorrencias, currentCliente);
  } catch (err) { toast(`❌ ${err.message}`, 'error'); }
}

async function editCobranca(id) {
  try { const c = await API.buscarCobranca(id); showCobrancaForm(c); }
  catch (err) { toast(`❌ ${err.message}`, 'error'); }
}

// ============================================================
//  PARCELAMENTO — Modal completo
// ============================================================
function showParcelamentoForm(cobrancaId) {
  const cob = currentCobrancas.find(c => c.id === cobrancaId);
  if (!cob) { toast('Cobrança não encontrada.', 'error'); return; }
  const clienteCpf = currentCliente?.cpfCnpj || '';

  const body = `
    <div class="parc-resumo">
      <div class="parc-resumo-item"><span class="parc-label">Débito</span><span class="parc-value">${esc(cob.descricao)}</span></div>
      <div class="parc-resumo-item"><span class="parc-label">Valor Original</span><span class="parc-value parc-value-destaque" id="parc-label-original">${formatCurrency(cob.valorOriginal||cob.valor)}</span></div>
      <div class="parc-resumo-item"><span class="parc-label">Valor Negociado</span><span class="parc-value parc-value-verde" id="parc-label-final">—</span></div>
      ${cob.empresaCredora ? `<div class="parc-resumo-item"><span class="parc-label">Credor</span><span class="parc-value">${esc(cob.empresaCredora)}</span></div>` : ''}
    </div>

    <div class="form-section-title">💸 Desconto e Juros</div>
    <div class="form-row">
      <div class="form-group">
        <label>Desconto (%)</label>
        <div class="input-suffix-wrap">
          <input type="number" id="parc-desconto" step="0.1" min="0" max="100"
            value="${cob.descontoPercentual ?? ''}" placeholder="0.00" oninput="recalcularNegociacao(${Number(cob.valorOriginal||cob.valor)})">
          <span class="input-suffix">%</span>
        </div>
        <small class="form-hint">Redução direta sobre o valor</small>
      </div>
      <div class="form-group">
        <label>Juros ao mês (%)</label>
        <div class="input-suffix-wrap">
          <input type="number" id="parc-juros-mensal" step="0.01" min="0" max="30"
            value="${cob.taxaJurosMensal ?? ''}" placeholder="0.00" oninput="recalcularNegociacao(${Number(cob.valorOriginal||cob.valor)})">
          <span class="input-suffix">% a.m.</span>
        </div>
        <small class="form-hint">Acréscimo sobre o parcelamento</small>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Campanha</label>
        <select id="parc-campanha" onchange="aplicarCampanha(${Number(cob.valorOriginal||cob.valor)})">
          <option value="">— Sem campanha —</option>
          <option value="ZERO_JUROS" ${cob.campanha==='ZERO_JUROS'?'selected':''}>🎯 Zero Juros</option>
          <option value="TAXA_REDUZIDA_50" ${cob.campanha==='TAXA_REDUZIDA_50'?'selected':''}>📉 Taxa Reduzida 50%</option>
          <option value="DESCONTO_30" ${cob.campanha==='DESCONTO_30'?'selected':''}>🏷️ Desconto 30%</option>
          <option value="DESCONTO_50" ${cob.campanha==='DESCONTO_50'?'selected':''}>🏷️ Desconto 50%</option>
          <option value="BLACK_FRIDAY" ${cob.campanha==='BLACK_FRIDAY'?'selected':''}>🖤 Black Friday 60%</option>
          <option value="PERSONALIZADA" ${cob.campanha==='PERSONALIZADA'?'selected':''}>✏️ Personalizada</option>
        </select>
        <small class="form-hint">Aplica pré-configuração de taxa</small>
      </div>
      <div class="form-group">
        <label>Código da Campanha</label>
        <input type="text" id="parc-campanha-codigo" value="${esc(cob.campanha||'')}" maxlength="60" placeholder="Ex: JULHO_ZERO_JUROS">
      </div>
    </div>

    <div class="form-section-title">📋 Parcelamento</div>
    <div class="form-row">
      <div class="form-group">
        <label>Número de Parcelas *</label>
        <select id="parc-qtd" onchange="recalcularNegociacao(${Number(cob.valorOriginal||cob.valor)})">
          <option value="">Selecione...</option>
          ${[1,2,3,4,5,6,7,8,9,10,12,15,18,24,36,48,60].map(n =>
            `<option value="${n}" ${cob.numeroParcelas===n?'selected':''}>${n === 1 ? '1x (À Vista)' : n+'x'}</option>`
          ).join('')}
        </select>
        <div class="form-error hidden" id="err-parc-qtd"></div>
      </div>
      <div class="form-group">
        <label>Valor por Parcela</label>
        <input type="text" id="parc-valor-calc" readonly style="background:rgba(255,255,255,0.04);cursor:not-allowed">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Forma de Cobrança *</label>
        <select id="parc-forma" onchange="toggleDadosBancarios()">
          <option value="">Selecione...</option>
          <option value="BOLETO" ${cob.formaParcelamento==='BOLETO'?'selected':''}>🧾 Boleto Bancário</option>
          <option value="DEBITO_AUTOMATICO" ${cob.formaParcelamento==='DEBITO_AUTOMATICO'?'selected':''}>🔄 Débito Automático</option>
          <option value="CARTAO_CREDITO" ${cob.formaParcelamento==='CARTAO_CREDITO'?'selected':''}>💳 Cartão de Crédito</option>
        </select>
        <div class="form-error hidden" id="err-parc-forma"></div>
      </div>
      <div class="form-group">
        <label>Data da 1ª Parcela *</label>
        <input type="date" id="parc-data-primeira" value="${cob.dataPrimeiraParcela||''}">
        <div class="form-error hidden" id="err-parc-data"></div>
      </div>
    </div>

    <div class="form-group">
      <label>Código do Parcelamento</label>
      <input type="text" id="parc-codigo" value="${esc(cob.codigoParcelamento||'')}" maxlength="30" placeholder="Gerado automaticamente se vazio">
    </div>

    <!-- Dados para Débito Automático -->
    <div id="dados-bancarios-wrap" class="dados-bancarios-section hidden">
      <div class="form-section-title">🏦 Dados para Débito Automático</div>
      <p class="form-section-hint">Preencha o CPF/CNPJ <strong>ou</strong> agência + conta</p>
      <div class="form-group">
        <label>CPF/CNPJ do Titular</label>
        <input type="text" id="parc-cpf" value="${esc(clienteCpf)}" maxlength="18"
          oninput="this.value=maskCpfCnpj(this.value)">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Instituição Bancária</label>
          <input type="text" id="parc-banco-nome" value="${esc(cob.bancoNome||'')}" maxlength="80" placeholder="Ex: Itaú, Nubank...">
        </div>
        <div class="form-group">
          <label>Agência</label>
          <input type="text" id="parc-banco-agencia" value="${esc(cob.bancoAgencia||'')}" maxlength="10">
        </div>
      </div>
      <div class="form-group">
        <label>Conta Corrente</label>
        <input type="text" id="parc-banco-conta" value="${esc(cob.bancoConta||'')}" maxlength="20">
      </div>
    </div>

    <!-- Dados para Cartão -->
    <div id="dados-cartao-wrap" class="dados-bancarios-section hidden">
      <div class="form-section-title">💳 Dados para Cartão de Crédito</div>
      <div class="form-group">
        <label>CPF/CNPJ do Titular *</label>
        <input type="text" id="parc-cpf-cartao" value="${esc(clienteCpf)}" maxlength="18"
          oninput="this.value=maskCpfCnpj(this.value)">
      </div>
    </div>

    <div class="form-group">
      <label>Observações do Acordo</label>
      <textarea id="parc-obs" rows="2" maxlength="400"
        placeholder="Condições negociadas, observações...">${esc(cob.observacoes||'')}</textarea>
    </div>`;

  openModal('🗓️ Negociar Parcelamento', body, [
    { label: 'Cancelar', class: 'btn-ghost', onClick: closeModal },
    { label: '✅ Confirmar Acordo', class: 'btn-primary',
      onClick: () => saveParcelamento(cobrancaId, Number(cob.valorOriginal||cob.valor)) },
  ]);

  setTimeout(() => {
    recalcularNegociacao(Number(cob.valorOriginal||cob.valor));
    toggleDadosBancarios();
  }, 60);
}

function calcularParcela(valorTotal) { recalcularNegociacao(valorTotal); }

function recalcularNegociacao(valorOriginal) {
  const descPct    = parseFloat(document.getElementById('parc-desconto')?.value) || 0;
  const jurosMen   = parseFloat(document.getElementById('parc-juros-mensal')?.value) || 0;
  const qtd        = parseInt(document.getElementById('parc-qtd')?.value) || 0;
  const displayParc = document.getElementById('parc-valor-calc');
  const labelFinal  = document.getElementById('parc-label-final');

  // 1. Aplica desconto
  const descValor = valorOriginal * descPct / 100;
  let valorBase = valorOriginal - descValor;

  // 2. Aplica juros simples (taxa × parcelas)
  if (jurosMen > 0 && qtd > 0) {
    valorBase = valorBase * (1 + (jurosMen * qtd / 100));
  }
  valorBase = Math.round(valorBase * 100) / 100;

  if (labelFinal) {
    labelFinal.textContent = formatCurrency(valorBase);
    // Verde se houve desconto, vermelho se juros aumentaram
    labelFinal.style.color = valorBase < valorOriginal ? '#69f0ae' : valorBase > valorOriginal ? '#ff5252' : '#e8eaf6';
  }

  if (displayParc) {
    if (!qtd) { displayParc.value = '—'; return; }
    displayParc.value = formatCurrency(valorBase / qtd);
  }
}

// Aplica campanhas pré-configuradas
function aplicarCampanha(valorOriginal) {
  const camp = document.getElementById('parc-campanha')?.value;
  const descInput  = document.getElementById('parc-desconto');
  const jurosInput = document.getElementById('parc-juros-mensal');
  const codInput   = document.getElementById('parc-campanha-codigo');

  const CAMPANHAS = {
    'ZERO_JUROS':        { desconto: 0,  juros: 0,    codigo: 'ZERO_JUROS' },
    'TAXA_REDUZIDA_50':  { desconto: 0,  juros: 0.99, codigo: 'TAXA_REDUZIDA_50' },
    'DESCONTO_30':       { desconto: 30, juros: 0,    codigo: 'DESCONTO_30' },
    'DESCONTO_50':       { desconto: 50, juros: 0,    codigo: 'DESCONTO_50' },
    'BLACK_FRIDAY':      { desconto: 60, juros: 0,    codigo: 'BLACK_FRIDAY' },
  };

  if (camp && CAMPANHAS[camp]) {
    const cfg = CAMPANHAS[camp];
    if (descInput)  descInput.value  = cfg.desconto;
    if (jurosInput) jurosInput.value = cfg.juros;
    if (codInput && !codInput.value)  codInput.value = cfg.codigo;
    toast(`🎯 Campanha "${camp}" aplicada!`, 'info', 2500);
  }
  recalcularNegociacao(valorOriginal);
}

function toggleDadosBancarios() {
  const forma = document.getElementById('parc-forma')?.value;
  const bancWrap = document.getElementById('dados-bancarios-wrap');
  const cartWrap = document.getElementById('dados-cartao-wrap');
  if (!bancWrap || !cartWrap) return;
  bancWrap.classList.toggle('hidden', forma !== 'DEBITO_AUTOMATICO');
  cartWrap.classList.toggle('hidden', forma !== 'CARTAO_CREDITO');
}

async function saveParcelamento(cobrancaId, valorTotal) {
  // Validações
  const qtd = parseInt(document.getElementById('parc-qtd').value);
  const forma = document.getElementById('parc-forma').value;
  const dataFirst = document.getElementById('parc-data-primeira').value;

  let hasError = false;
  if (!qtd || qtd < 2) { showFieldError('parc-qtd', 'Selecione o número de parcelas'); hasError = true; }
  if (!forma) { showFieldError('parc-forma', 'Selecione a forma de cobrança'); hasError = true; }
  if (!dataFirst) { showFieldError('parc-data', 'Informe a data da 1ª parcela'); hasError = true; }
  if (hasError) return;

  // Calcula valor final com desconto e juros
  const descPct    = parseFloat(document.getElementById('parc-desconto')?.value) || 0;
  const jurosMen   = parseFloat(document.getElementById('parc-juros-mensal')?.value) || 0;
  const descValor  = valorTotal * descPct / 100;
  let   valorFinal = valorTotal - descValor;
  if (jurosMen > 0 && qtd > 0) { valorFinal = valorFinal * (1 + (jurosMen * qtd / 100)); }
  valorFinal = Math.round(valorFinal * 100) / 100;

  const valorParcela = valorFinal / qtd;
  const campSelect = document.getElementById('parc-campanha')?.value || '';
  const campCodigo = document.getElementById('parc-campanha-codigo')?.value.trim() || campSelect || null;
  const codigo = document.getElementById('parc-codigo').value.trim() ||
    `PARC-${currentCliente.id}-${Date.now().toString(36).toUpperCase()}`;

  const cpfCob = (document.getElementById('parc-cpf')?.value ||
    document.getElementById('parc-cpf-cartao')?.value ||
    currentCliente?.cpfCnpj || '').trim();

  const data = {
    parcelado: true,
    numeroParcelas: qtd,
    parcelaAtual: 1,
    valorParcela:      parseFloat(valorParcela.toFixed(2)),
    valorFinal:        parseFloat(valorFinal.toFixed(2)),
    descontoPercentual: descPct > 0 ? descPct : null,
    descontoValor:     descPct > 0 ? parseFloat(descValor.toFixed(2)) : null,
    taxaJurosMensal:   jurosMen > 0 ? jurosMen : null,
    campanha:          campCodigo,
    formaParcelamento: forma,
    dataPrimeiraParcela: dataFirst,
    codigoParcelamento: codigo,
    cpfCobranca: cpfCob || null,
    bancoNome:    document.getElementById('parc-banco-nome')?.value.trim() || null,
    bancoAgencia: document.getElementById('parc-banco-agencia')?.value.trim() || null,
    bancoConta:   document.getElementById('parc-banco-conta')?.value.trim() || null,
    observacoes:  document.getElementById('parc-obs').value.trim() || null,
    status: 'EM_NEGOCIACAO',
  };

  try {
    // Busca cobrança atual e mescla com dados de parcelamento
    const cobAtual = await API.buscarCobranca(cobrancaId);
    const merged = { ...cobAtual, ...data, cliente: { id: currentCliente.id } };
    // Remove refs circulares antes de enviar
    delete merged.cliente?.cobrancas;
    delete merged.cliente?.ocorrencias;

    await API.atualizarCobranca(cobrancaId, merged);
    // Ocorrência automática de acordo
    await registrarOcorrenciaAcordo([cobrancaId], { atendente: localStorage.getItem('intelicob_user') || 'Operador' });
    toast(`✅ Parcelamento em ${qtd}x confirmado! Ocorrência registrada.`, 'success', 4000);
    closeModal();

    currentCobrancas = await API.cobrancasPorCliente(currentCliente.id);
    currentOcorrencias = await API.ocorrenciasPorCliente(currentCliente.id);
    renderCobrancasCliente(currentCobrancas);
    renderNegociacao(currentCobrancas);
    renderAcordos(currentCobrancas);
    renderResumo(currentCobrancas, currentOcorrencias, currentCliente);
  } catch (err) {
    toast(`❌ ${err.message}`, 'error');
  }
}



// ============================================================
//  NEGOCIAÇÃO CONSOLIDADA — Aba "🤝 Negociação"
// ============================================================
let negSelecionados = new Set(); // IDs das cobranças selecionadas

function renderNegociacao(cobrancas) {
  const lista = document.getElementById('neg-lista');
  const subtitle = document.getElementById('neg-subtitle');
  if (!lista) return;

  // Filtra só as cobranças em aberto (não pagas, não canceladas)
  const abertas = (cobrancas || []).filter(c =>
    !['PAGO', 'CANCELADO'].includes(c.status)
  );

  if (!abertas.length) {
    lista.innerHTML = '<p class="empty-state">✅ Nenhum débito em aberto para negociar.</p>';
    if (subtitle) subtitle.textContent = 'Nenhum débito pendente encontrado.';
    return;
  }
  if (subtitle) subtitle.textContent = `${abertas.length} débito(s) em aberto — selecione para negociar`;

  negSelecionados.clear();
  lista.innerHTML = '';

  abertas.forEach(c => {
    const sInfo = statusCobrancaInfo(c.status);
    const parc  = c.parcelado && c.numeroParcelas
      ? `<span class="neg-badge-parc">🗓️ ${c.numeroParcelas}x</span>` : '';
    const desc  = c.descontoPercentual ? `<span class="neg-badge-desc">-${c.descontoPercentual}%</span>` : '';

    const card = document.createElement('div');
    card.className = 'neg-card';
    card.dataset.id = c.id;

    // Checkbox
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'neg-chk';
    chk.id = `neg-chk-${c.id}`;
    chk.addEventListener('change', () => {
      if (chk.checked) negSelecionados.add(c.id);
      else negSelecionados.delete(c.id);
      card.classList.toggle('neg-card-selected', chk.checked);
      atualizarResumoNeg(cobrancas);
    });

    const body = document.createElement('div');
    body.className = 'neg-card-body';

    // Título
    const titulo = document.createElement('div');
    titulo.className = 'neg-card-titulo';
    const tLabel = document.createElement('label');
    tLabel.htmlFor = `neg-chk-${c.id}`;
    tLabel.className = 'neg-card-desc';
    tLabel.textContent = c.descricao;
    titulo.appendChild(tLabel);
    if (parc || desc) {
      const badges = document.createElement('span');
      badges.className = 'neg-badges';
      badges.innerHTML = parc + desc; // badges são estáticos (sem dados do usuário)
      titulo.appendChild(badges);
    }

    // Detalhes
    const details = document.createElement('div');
    details.className = 'neg-card-details';

    const detItems = [
      { icon: '💰', text: formatCurrency(c.valorFinal || c.valor) },
      { icon: '🏢', text: c.empresaCredora || null },
      { icon: '📅', text: `Venc: ${formatDate(c.dataVencimento)}` },
      { icon: '🏷️', text: statusLabel(c.status) },
    ].filter(d => d.text);

    detItems.forEach(d => {
      const sp = document.createElement('span');
      const icon = document.createTextNode(d.icon + ' ');
      const txt  = document.createTextNode(d.text);
      sp.appendChild(icon);
      sp.appendChild(txt);
      details.appendChild(sp);
    });

    // Observações
    let obsEl = null;
    if (c.observacoes) {
      obsEl = document.createElement('div');
      obsEl.className = 'neg-card-obs';
      const obsIcon = document.createTextNode('📝 ');
      const obsTxt  = document.createTextNode(c.observacoes);
      obsEl.appendChild(obsIcon);
      obsEl.appendChild(obsTxt);
    }

    // Botão individual
    const actions = document.createElement('div');
    actions.className = 'neg-card-actions';
    const btnInd = document.createElement('button');
    btnInd.className = 'action-btn action-btn-parc';
    btnInd.textContent = '🗓️ Negociar este';
    btnInd.addEventListener('click', () => showParcelamentoForm(c.id));
    actions.appendChild(btnInd);

    body.appendChild(titulo);
    body.appendChild(details);
    if (obsEl) body.appendChild(obsEl);
    body.appendChild(actions);

    card.appendChild(chk);
    card.appendChild(body);
    lista.appendChild(card);
  });

  atualizarResumoNeg(cobrancas);
}

function atualizarResumoNeg(cobrancas) {
  const box   = document.getElementById('neg-resumo-box');
  const count = document.getElementById('neg-count');
  const total = document.getElementById('neg-total');
  if (!box) return;

  if (negSelecionados.size === 0) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  if (count) count.textContent = negSelecionados.size;

  const soma = Array.from(negSelecionados).reduce((acc, id) => {
    const c = (cobrancas || []).find(x => x.id === id);
    return acc + Number(c?.valorFinal || c?.valor || 0);
  }, 0);
  if (total) total.textContent = formatCurrency(soma);
}

function statusLabel(status) {
  const MAP = {
    PENDENTE:       'Pendente',
    VENCIDO:        'Vencido',
    EM_NEGOCIACAO:  'Em Negociação',
    PAGO:           'Pago',
    CANCELADO:      'Cancelado',
    ACORDO:         'Acordo',
  };
  return MAP[status] || status;
}

function initNegociacaoButtons() {
  const btnTodos = document.getElementById('btn-neg-selecionar-todos');
  const btnAvista = document.getElementById('btn-neg-pagar-avista');
  const btnParcelar = document.getElementById('btn-neg-parcelar');

  if (btnTodos) {
    btnTodos.addEventListener('click', () => {
      const chks = document.querySelectorAll('.neg-chk');
      const todosChecked = Array.from(chks).every(c => c.checked);
      chks.forEach(c => {
        c.checked = !todosChecked;
        const id = parseInt(c.id.replace('neg-chk-', ''));
        if (!todosChecked) negSelecionados.add(id);
        else negSelecionados.delete(id);
        c.closest('.neg-card')?.classList.toggle('neg-card-selected', !todosChecked);
      });
      atualizarResumoNeg(currentCobrancas);
      btnTodos.textContent = todosChecked ? '☑️ Selecionar Todos' : '☐ Desmarcar Todos';
    });
  }

  if (btnAvista) {
    btnAvista.addEventListener('click', () => {
      if (!negSelecionados.size) return;
      showNegociacaoConsolidada('AVISTA');
    });
  }

  if (btnParcelar) {
    btnParcelar.addEventListener('click', () => {
      if (!negSelecionados.size) return;
      showNegociacaoConsolidada('PARCELAR');
    });
  }
}

function showNegociacaoConsolidada(modo) {
  const selecionadas = Array.from(negSelecionados).map(id =>
    currentCobrancas.find(c => c.id === id)
  ).filter(Boolean);

  if (!selecionadas.length) return;

  const totalOriginal = selecionadas.reduce((a, c) => a + Number(c.valorOriginal || c.valor), 0);
  const clienteCpf = currentCliente?.cpfCnpj || '';

  const listaHtml = selecionadas.map(c => {
    const div = document.createElement('div');
    div.className = 'neg-modal-item';
    const icon = document.createTextNode('• ');
    const desc = document.createTextNode(c.descricao);
    const val  = document.createTextNode(' — ' + formatCurrency(c.valorOriginal || c.valor));
    div.appendChild(icon); div.appendChild(desc); div.appendChild(val);
    return div.outerHTML;
  }).join('');

  const parcBody = modo === 'PARCELAR' ? `
    <div class="form-section-title">📋 Parcelamento</div>
    <div class="form-row">
      <div class="form-group">
        <label>Número de Parcelas *</label>
        <select id="neg-parc-qtd" onchange="recalcularNeg(${totalOriginal})">
          <option value="">Selecione...</option>
          ${[2,3,4,5,6,7,8,9,10,12,15,18,24,36,48,60].map(n =>
            `<option value="${n}">${n}x</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Valor por Parcela</label>
        <input type="text" id="neg-parc-calc" readonly style="background:rgba(255,255,255,0.04);cursor:not-allowed">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Forma de Cobrança *</label>
        <select id="neg-parc-forma" onchange="toggleNegDadosBancarios()">
          <option value="">Selecione...</option>
          <option value="BOLETO">🧾 Boleto Bancário</option>
          <option value="DEBITO_AUTOMATICO">🔄 Débito Automático</option>
          <option value="CARTAO_CREDITO">💳 Cartão de Crédito</option>
        </select>
      </div>
      <div class="form-group">
        <label>Data da 1ª Parcela *</label>
        <input type="date" id="neg-parc-data">
      </div>
    </div>
    <div id="neg-dados-bancarios" class="dados-bancarios-section hidden">
      <div class="form-section-title">🏦 Dados Bancários</div>
      <div class="form-group">
        <label>CPF/CNPJ</label>
        <input type="text" id="neg-cpf" value="${esc(clienteCpf)}" maxlength="18" oninput="this.value=maskCpfCnpj(this.value)">
      </div>
      <div class="form-row">
        <div class="form-group"><label>Banco</label><input type="text" id="neg-banco-nome" maxlength="80" placeholder="Ex: Itaú"></div>
        <div class="form-group"><label>Agência</label><input type="text" id="neg-banco-agencia" maxlength="10"></div>
      </div>
      <div class="form-group"><label>Conta</label><input type="text" id="neg-banco-conta" maxlength="20"></div>
    </div>` : '';

  const body = `
    <div class="neg-modal-lista-wrap">
      <div class="form-section-title">📋 Débitos Incluídos (${selecionadas.length})</div>
      <div class="neg-modal-lista">${listaHtml}</div>
    </div>

    <div class="parc-resumo" style="margin:1rem 0">
      <div class="parc-resumo-item">
        <span class="parc-label">Valor Total Original</span>
        <span class="parc-value parc-value-destaque">${formatCurrency(totalOriginal)}</span>
      </div>
      <div class="parc-resumo-item">
        <span class="parc-label">Valor Negociado</span>
        <span class="parc-value parc-value-verde" id="neg-valor-final">${formatCurrency(totalOriginal)}</span>
      </div>
    </div>

    <div class="form-section-title">💸 Desconto / Juros</div>
    <div class="form-row">
      <div class="form-group">
        <label>Desconto (%)</label>
        <div class="input-suffix-wrap">
          <input type="number" id="neg-desconto" step="0.1" min="0" max="100" placeholder="0.00"
            oninput="recalcularNeg(${totalOriginal})">
          <span class="input-suffix">%</span>
        </div>
      </div>
      <div class="form-group">
        <label>Juros a.m. (%)</label>
        <div class="input-suffix-wrap">
          <input type="number" id="neg-juros" step="0.01" min="0" max="30" placeholder="0.00"
            oninput="recalcularNeg(${totalOriginal})">
          <span class="input-suffix">% a.m.</span>
        </div>
      </div>
    </div>

    ${parcBody}

    <div class="form-group">
      <label>Observações do Acordo</label>
      <textarea id="neg-obs" rows="2" maxlength="400" placeholder="Condições negociadas, descontos..."></textarea>
    </div>`;

  const titulo = modo === 'PARCELAR'
    ? `🗓️ Negociação Consolidada — Parcelamento (${selecionadas.length} débitos)`
    : `💵 Negociação Consolidada — À Vista (${selecionadas.length} débitos)`;

  openModal(titulo, body, [
    { label: 'Cancelar', class: 'btn-ghost', onClick: closeModal },
    { label: '✅ Confirmar Acordo', class: 'btn-primary',
      onClick: () => salvarNegociacaoConsolidada(selecionadas, modo, totalOriginal) },
  ]);

  setTimeout(() => {
    recalcularNeg(totalOriginal);
    if (modo === 'PARCELAR') toggleNegDadosBancarios();
  }, 60);
}

function recalcularNeg(totalOriginal) {
  const descPct  = parseFloat(document.getElementById('neg-desconto')?.value) || 0;
  const jurosMen = parseFloat(document.getElementById('neg-juros')?.value) || 0;
  const qtd      = parseInt(document.getElementById('neg-parc-qtd')?.value) || 0;

  const descVal = totalOriginal * descPct / 100;
  let valorFinal = totalOriginal - descVal;
  if (jurosMen > 0 && qtd > 0) valorFinal = valorFinal * (1 + jurosMen * qtd / 100);
  valorFinal = Math.round(valorFinal * 100) / 100;

  const labelFinal = document.getElementById('neg-valor-final');
  if (labelFinal) {
    labelFinal.textContent = formatCurrency(valorFinal);
    labelFinal.style.color = valorFinal < totalOriginal ? '#69f0ae' : valorFinal > totalOriginal ? '#ff5252' : '#e8eaf6';
  }

  const parcCalc = document.getElementById('neg-parc-calc');
  if (parcCalc && qtd > 0) parcCalc.value = formatCurrency(valorFinal / qtd);
  else if (parcCalc) parcCalc.value = '—';
}

function toggleNegDadosBancarios() {
  const forma = document.getElementById('neg-parc-forma')?.value;
  document.getElementById('neg-dados-bancarios')?.classList.toggle('hidden', forma !== 'DEBITO_AUTOMATICO');
}

async function salvarNegociacaoConsolidada(selecionadas, modo, totalOriginal) {
  const descPct  = parseFloat(document.getElementById('neg-desconto')?.value) || 0;
  const jurosMen = parseFloat(document.getElementById('neg-juros')?.value) || 0;
  const obs      = document.getElementById('neg-obs')?.value.trim() || null;

  let qtd = 1, forma = 'BOLETO', dataFirst = null;

  if (modo === 'PARCELAR') {
    qtd = parseInt(document.getElementById('neg-parc-qtd')?.value);
    forma = document.getElementById('neg-parc-forma')?.value;
    dataFirst = document.getElementById('neg-parc-data')?.value;
    if (!qtd || qtd < 2) { toast('❌ Selecione o número de parcelas', 'error'); return; }
    if (!forma) { toast('❌ Selecione a forma de cobrança', 'error'); return; }
    if (!dataFirst) { toast('❌ Informe a data da 1ª parcela', 'error'); return; }
  }

  const descVal  = totalOriginal * descPct / 100;
  let valorFinal = totalOriginal - descVal;
  if (jurosMen > 0 && qtd > 1) valorFinal = valorFinal * (1 + jurosMen * qtd / 100);
  valorFinal = Math.round(valorFinal * 100) / 100;

  // Distribui o valor final proporcionalmente entre os débitos
  const totalBruto = selecionadas.reduce((a, c) => a + Number(c.valorOriginal || c.valor), 0);
  const codigo = `CONSOL-${currentCliente.id}-${Date.now().toString(36).toUpperCase()}`;

  const cpfCob     = document.getElementById('neg-cpf')?.value.trim() || currentCliente?.cpfCnpj || null;
  const bancoNome  = document.getElementById('neg-banco-nome')?.value.trim() || null;
  const bancoAg    = document.getElementById('neg-banco-agencia')?.value.trim() || null;
  const bancoConta = document.getElementById('neg-banco-conta')?.value.trim() || null;

  try {
    for (const cob of selecionadas) {
      const proporcao = totalBruto > 0 ? Number(cob.valorOriginal || cob.valor) / totalBruto : 1 / selecionadas.length;
      const valCobFinal = Math.round(valorFinal * proporcao * 100) / 100;
      const valParc     = modo === 'PARCELAR' ? Math.round(valCobFinal / qtd * 100) / 100 : null;

      const cobAtual = await API.buscarCobranca(cob.id);
      const merged = {
        ...cobAtual,
        status:             'EM_NEGOCIACAO',
        valor:              valCobFinal,
        valorFinal:         valCobFinal,
        descontoPercentual: descPct > 0 ? descPct : null,
        descontoValor:      descPct > 0 ? Math.round(Number(cob.valorOriginal||cob.valor) * descPct / 100 * 100) / 100 : null,
        taxaJurosMensal:    jurosMen > 0 ? jurosMen : null,
        parcelado:          modo === 'PARCELAR',
        numeroParcelas:     modo === 'PARCELAR' ? qtd : null,
        parcelaAtual:       modo === 'PARCELAR' ? 1 : null,
        valorParcela:       valParc,
        formaParcelamento:  modo === 'PARCELAR' ? forma : null,
        formaPagamento:     modo === 'AVISTA' ? forma : cobAtual.formaPagamento,
        dataPrimeiraParcela: dataFirst || null,
        codigoParcelamento: codigo,
        cpfCobranca:        cpfCob,
        bancoNome, bancoAgencia: bancoAg, bancoConta,
        observacoes:        obs,
        cliente: { id: currentCliente.id },
      };
      delete merged.cliente?.cobrancas;
      delete merged.cliente?.ocorrencias;

      await API.atualizarCobranca(cob.id, merged);
    }

    // Ocorrência automática para cada débito do acordo consolidado
    const ids = selecionadas.map(c => c.id);
    await registrarOcorrenciaAcordo(ids, { atendente: localStorage.getItem('intelicob_user') || 'Operador' });
    toast(`✅ Acordo consolidado para ${selecionadas.length} débito(s)! ${ids.length} ocorrência(s) registrada(s).`, 'success', 5000);
    closeModal();
    negSelecionados.clear();
    currentCobrancas = await API.cobrancasPorCliente(currentCliente.id);
    currentOcorrencias = await API.ocorrenciasPorCliente(currentCliente.id);
    renderNegociacao(currentCobrancas);
    renderCobrancasCliente(currentCobrancas);
    renderAcordos(currentCobrancas);
    renderResumo(currentCobrancas, currentOcorrencias, currentCliente);
  } catch (err) {
    toast(`❌ ${err.message}`, 'error');
  }
}


// ============================================================
//  ACORDOS FECHADOS — Aba "📄 Acordos"
// ============================================================

function renderAcordos(cobrancas) {
  const el = document.getElementById('acordos-list');
  if (!el) return;

  // Filtra cobranças que têm acordo (EM_NEGOCIACAO + tem codigoParcelamento ou valorFinal)
  const acordos = (cobrancas || []).filter(c =>
    c.status === 'EM_NEGOCIACAO' || c.status === 'ACORDO'
  ).filter(c => c.codigoParcelamento || c.valorFinal);

  if (!acordos.length) {
    el.innerHTML = '<p class="empty-state">📭 Nenhum acordo fechado ainda. Use a aba Negociação para criar um.</p>';
    return;
  }

  // Agrupa por codigoParcelamento (acordos consolidados aparecem como um só)
  const grupos = {};
  acordos.forEach(c => {
    const key = c.codigoParcelamento || `IND-${c.id}`;
    if (!grupos[key]) grupos[key] = { codigo: key, cobrancas: [], total: 0 };
    grupos[key].cobrancas.push(c);
    grupos[key].total += Number(c.valorFinal || c.valor);
  });

  el.innerHTML = '';
  Object.values(grupos).forEach(grupo => {
    const primeira = grupo.cobrancas[0];
    const isConsolidado = grupo.cobrancas.length > 1;
    const isParcelado = primeira.parcelado && primeira.numeroParcelas;

    const card = document.createElement('div');
    card.className = 'acordo-card';

    // Header do card
    const header = document.createElement('div');
    header.className = 'acordo-card-header';

    const left = document.createElement('div');
    left.className = 'acordo-header-left';

    const titulo = document.createElement('div');
    titulo.className = 'acordo-card-titulo';
    const icon = isConsolidado ? '📑' : '📄';
    const tipoTxt = document.createTextNode(`${icon} ${isConsolidado ? 'Acordo Consolidado' : 'Acordo Individual'}`);
    titulo.appendChild(tipoTxt);
    left.appendChild(titulo);

    const codigo = document.createElement('div');
    codigo.className = 'acordo-card-codigo';
    codigo.textContent = `Cód: ${grupo.codigo}`;
    left.appendChild(codigo);

    // Badge de parcelamento
    if (isParcelado) {
      const parcBadge = document.createElement('div');
      parcBadge.className = 'acordo-badge-parc';
      parcBadge.textContent = `🗓️ ${primeira.parcelaAtual || 1}/${primeira.numeroParcelas}x de ${formatCurrency(primeira.valorParcela)}`;
      left.appendChild(parcBadge);
    }

    header.appendChild(left);

    // Status + valor
    const right = document.createElement('div');
    right.className = 'acordo-header-right';

    const sInfo = statusCobrancaInfo(primeira.status);
    const badge = document.createElement('span');
    badge.className = 'status-badge';
    badge.style.cssText = `background:${sInfo.color}22;border:1px solid ${sInfo.color}44;color:${sInfo.color};`;
    badge.textContent = `${sInfo.icon} ${sInfo.label}`;
    right.appendChild(badge);

    const valor = document.createElement('div');
    valor.className = 'acordo-card-valor';
    valor.textContent = formatCurrency(grupo.total);
    right.appendChild(valor);

    header.appendChild(right);
    card.appendChild(header);

    // Detalhes
    const details = document.createElement('div');
    details.className = 'acordo-card-details';

    const detItems = [];
    detItems.push({ icon: '💰', label: 'Valor negociado', value: formatCurrency(grupo.total) });
    if (primeira.descontoPercentual) {
      detItems.push({ icon: '🏷️', label: 'Desconto', value: `${primeira.descontoPercentual}% (−${formatCurrency(primeira.descontoValor)})` });
    }
    if (primeira.taxaJurosMensal) {
      detItems.push({ icon: '📈', label: 'Juros', value: `${primeira.taxaJurosMensal}% a.m.` });
    }
    if (primeira.campanha) {
      detItems.push({ icon: '🎯', label: 'Campanha', value: primeira.campanha });
    }
    const venc = primeira.dataPrimeiraParcela || primeira.dataVencimento;
    detItems.push({ icon: '📅', label: '1º Vencimento', value: formatDate(venc) });
    const forma = primeira.formaParcelamento || primeira.formaPagamento;
    if (forma) {
      const fInfo = formaPagamentoInfo(forma);
      detItems.push({ icon: fInfo.icon, label: 'Forma', value: fInfo.label });
    }

    detItems.forEach(d => {
      const item = document.createElement('div');
      item.className = 'acordo-detail-item';
      const label = document.createElement('span');
      label.className = 'acordo-detail-label';
      label.textContent = `${d.icon} ${d.label}`;
      const val = document.createElement('span');
      val.className = 'acordo-detail-value';
      val.textContent = d.value;
      item.appendChild(label);
      item.appendChild(val);
      details.appendChild(item);
    });
    card.appendChild(details);

    // Lista de débitos incluídos (só se consolidado)
    if (isConsolidado) {
      const listaWrap = document.createElement('div');
      listaWrap.className = 'acordo-debitos-lista';
      const listaTitle = document.createElement('p');
      listaTitle.className = 'acordo-debitos-title';
      listaTitle.textContent = `📋 ${grupo.cobrancas.length} débitos incluídos:`;
      listaWrap.appendChild(listaTitle);

      grupo.cobrancas.forEach(c => {
        const item = document.createElement('div');
        item.className = 'acordo-debito-item';
        item.textContent = `• ${c.descricao} — ${formatCurrency(c.valorFinal || c.valor)}`;
        listaWrap.appendChild(item);
      });
      card.appendChild(listaWrap);
    }

    // Observações
    if (primeira.observacoes) {
      const obs = document.createElement('div');
      obs.className = 'acordo-card-obs';
      obs.textContent = `📝 ${primeira.observacoes}`;
      card.appendChild(obs);
    }

    // Ações: gerar boleto + copiar linha digitável + enviar WhatsApp
    const actions = document.createElement('div');
    actions.className = 'acordo-card-actions';

    const btnBoleto = document.createElement('button');
    btnBoleto.className = 'btn-primary btn-sm';
    btnBoleto.textContent = '🧾 Gerar Boleto';
    btnBoleto.addEventListener('click', () => baixarBoleto(grupo));
    actions.appendChild(btnBoleto);

    if (currentCliente?.whatsapp || currentCliente?.telefone) {
      const btnWpp = document.createElement('button');
      btnWpp.className = 'btn-ghost btn-sm';
      btnWpp.textContent = '💬 Enviar via WhatsApp';
      btnWpp.addEventListener('click', () => enviarAcordoWhatsApp(grupo));
      actions.appendChild(btnWpp);
    }

    const btnCopiar = document.createElement('button');
    btnCopiar.className = 'btn-ghost btn-sm';
    btnCopiar.textContent = '📋 Copiar Resumo';
    btnCopiar.addEventListener('click', () => copiarResumoAcordo(grupo));
    actions.appendChild(btnCopiar);

    card.appendChild(actions);
    el.appendChild(card);
  });
}

async function baixarBoleto(grupo) {
  try {
    if (grupo.cobrancas.length === 1) {
      // Boleto individual
      toast('🧾 Gerando boleto...', 'info', 2000);
      await API.gerarBoleto(grupo.cobrancas[0].id);
      toast('✅ Boleto gerado! Verifique seus downloads.', 'success', 3000);
    } else {
      // Boleto consolidado
      toast('🧾 Gerando boleto consolidado...', 'info', 2000);
      await API.gerarBoletoConsolidado(grupo.codigo);
      toast('✅ Boleto consolidado gerado!', 'success', 3000);
    }
  } catch (err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

function copiarResumoAcordo(grupo) {
  const p = grupo.cobrancas[0];
  let resumo = `*ACORDO FECHADO - INTELICOB*\n`;
  resumo += `Código: ${grupo.codigo}\n`;
  resumo += `Valor: ${formatCurrency(grupo.total)}\n`;
  if (p.parcelado && p.numeroParcelas) {
    resumo += `Parcelamento: ${p.numeroParcelas}x de ${formatCurrency(p.valorParcela)}\n`;
    resumo += `1º vencimento: ${formatDate(p.dataPrimeiraParcela)}\n`;
  } else {
    resumo += `Pagamento: À vista\n`;
  }
  resumo += `Forma: ${formaPagamentoInfo(p.formaParcelamento || p.formaPagamento).label}\n`;
  if (grupo.cobrancas.length > 1) {
    resumo += `\nDébitos incluídos:\n`;
    grupo.cobrancas.forEach(c => { resumo += `• ${c.descricao} — ${formatCurrency(c.valorFinal||c.valor)}\n`; });
  }

  navigator.clipboard.writeText(resumo.replace(/\\n/g, '\n')).then(() => {
    toast('📋 Resumo copiado para a área de transferência!', 'success');
  }).catch(() => {
    toast('❌ Não foi possível copiar', 'error');
  });
}

function enviarAcordoWhatsApp(grupo) {
  const p = grupo.cobrancas[0];
  const tel = (currentCliente?.whatsapp || currentCliente?.telefone || '').replace(/\D/g, '');
  if (!tel) { toast('❌ Cliente sem telefone', 'error'); return; }

  let msg = `*ACORDO FECHADO - INTELICOB*%0A%0A`;
  msg += `Código: ${grupo.codigo}%0A`;
  msg += `Valor: ${formatCurrency(grupo.total)}%0A`;
  if (p.parcelado && p.numeroParcelas) {
    msg += `Parcelamento: ${p.numeroParcelas}x de ${formatCurrency(p.valorParcela)}%0A`;
    msg += `1º vencimento: ${formatDate(p.dataPrimeiraParcela)}%0A`;
  } else {
    msg += `Pagamento: À vista%0A`;
  }
  msg += `Forma: ${formaPagamentoInfo(p.formaParcelamento || p.formaPagamento).label}%0A%0A`;
  if (grupo.cobrancas.length > 1) {
    msg += `*Débitos incluídos:*%0A`;
    grupo.cobrancas.forEach(c => {
      msg += `• ${c.descricao} — ${formatCurrency(c.valorFinal||c.valor)}%0A`;
    });
  }
  msg += `%0A_Gere seu boleto pelo link: ${window.location.origin}_`;

  window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
}

// ============================================================
//  OCORRÊNCIA AUTOMÁTICA DE ACORDO
// ============================================================
async function registrarOcorrenciaAcordo(cobrancaIds, dados) {
  for (const id of cobrancaIds) {
    try {
      await API.registrarAcordo(id, dados);
    } catch (err) {
      console.warn(`Falha ao registrar ocorrência para cobrança ${id}:`, err.message);
    }
  }
}

// ============================================================
//  OCORRÊNCIAS
// ============================================================
function renderOcorrenciasCliente(ocorrencias) {
  const el = document.getElementById('cliente-ocorrencias-list');
  if (!ocorrencias?.length) { el.innerHTML = '<p class="empty-state">Nenhuma ocorrência registrada.</p>'; return; }
  el.innerHTML = ocorrencias.map(o => {
    const tInfo = tipoOcorrenciaInfo(o.tipoOcorrencia);
    const rInfo = resultadoOcorrenciaInfo(o.resultadoOcorrencia);
    return `<div class="oc-item">
      <div class="oc-item-header">
        <span>${tInfo.icon} ${tInfo.label}${rInfo?.label ? ` → ${rInfo.icon} ${rInfo.label}` : ''}</span>
        <span>${formatDateTime(o.dataRegistro)}</span>
      </div>
      ${o.atendente ? `<div class="oc-atendente">👤 Operador: ${esc(o.atendente)}</div>` : ''}
      <div class="oc-item-desc">${esc(o.descricao)}</div>
      ${o.gerouCompromisso ? `<div class="oc-tag">🤞 Promessa: ${formatDate(o.dataCompromisso)}${o.valorAcordo ? ` • ${formatCurrency(o.valorAcordo)}` : ''}</div>` : ''}
    </div>`;
  }).join('');
}

async function registrarOcorrencia() {
  if (!currentCliente) { toast('Selecione um cliente.', 'error'); return; }
  const descricao = document.getElementById('oc-descricao').value.trim();
  if (descricao.length < 10) { toast('Mínimo 10 caracteres.', 'error'); return; }
  const tipoOcorrencia = document.getElementById('oc-tipo').value;
  if (!tipoOcorrencia) { toast('Selecione o tipo de contato.', 'error'); return; }

  const gerouCompromisso = document.getElementById('oc-compromisso').value === 'true';
  const data = {
    descricao, tipoOcorrencia,
    resultadoOcorrencia: document.getElementById('oc-resultado').value || null,
    gerouCompromisso,
    dataCompromisso: gerouCompromisso ? document.getElementById('oc-data-compromisso').value || null : null,
    valorAcordo: gerouCompromisso ? (parseFloat(document.getElementById('oc-valor-acordo').value) || null) : null,
    atendente: currentUser?.nome || null,
    cliente: { id: currentCliente.id },
  };

  try {
    await API.criarOcorrencia(currentCliente.id, data);
    toast('✅ Ocorrência registrada!', 'success');
    // Reset form
    ['oc-descricao','oc-tipo','oc-resultado'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('oc-char-count').textContent = '0';
    document.getElementById('oc-compromisso').value = 'false';
    document.getElementById('oc-data-compromisso').value = '';
    document.getElementById('oc-data-compromisso').disabled = true;
    document.getElementById('oc-valor-acordo').value = '';
    document.getElementById('oc-valor-acordo').disabled = true;
    document.getElementById('btn-registrar-ocorrencia').disabled = true;

    currentOcorrencias = await API.listarOcorrencias(currentCliente.id);
    renderOcorrenciasCliente(currentOcorrencias);
    renderResumo(currentCobrancas, currentOcorrencias, currentCliente);
  } catch (err) { toast(`❌ ${err.message}`, 'error'); }
}

// ============================================================
//  EDITAR CLIENTE (inline)
// ============================================================
function renderEditForm(c) {
  const container = document.getElementById('edit-form-container');
  container.innerHTML = `
    <div class="form-group"><label>Nome *</label><input type="text" id="edit-nome" value="${esc(c.nome)}" maxlength="100"><div class="form-error hidden" id="err-edit-nome"></div></div>
    <div class="form-row">
      <div class="form-group"><label>CPF/CNPJ *</label><input type="text" id="edit-cpf" value="${esc(c.cpfCnpj || '')}" maxlength="18" oninput="this.value=maskCpfCnpj(this.value)"><div class="form-error hidden" id="err-edit-cpf"></div></div>
      <div class="form-group"><label>Status *</label><select id="edit-status">${CONFIG.STATUS_CLIENTE.map(s => `<option value="${s.value}" ${c.status === s.value ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>E-mail *</label><input type="email" id="edit-email" value="${esc(c.email)}" maxlength="150"><div class="form-error hidden" id="err-edit-email"></div></div>
      <div class="form-group"><label>Telefone *</label><input type="text" id="edit-telefone" value="${esc(c.telephone || c.telefone || '')}" maxlength="20" oninput="this.value=maskPhone(this.value)"><div class="form-error hidden" id="err-edit-telefone"></div></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>WhatsApp</label><input type="text" id="edit-whatsapp" value="${esc(c.whatsapp || '')}" maxlength="20" oninput="this.value=maskPhone(this.value)"></div>
      <div class="form-group"><label>Data de Nascimento</label><input type="date" id="edit-nascimento" value="${c.dataNascimento || ''}"></div>
    </div>
    <div class="form-group"><label>Renda Presumida (R$)</label><input type="number" id="edit-renda" step="0.01" min="0" value="${c.rendaPresumida ?? ''}"></div>
    <div class="form-row">
      <div class="form-group"><label>CEP</label><input type="text" id="edit-cep" value="${esc(c.cep || '')}" maxlength="9" oninput="this.value=maskCep(this.value)" onblur="autoPreencherCep()"></div>
      <div class="form-group"><label>UF</label><select id="edit-uf"><option value="">—</option>${CONFIG.UF_LIST.map(uf => `<option value="${uf}" ${c.uf === uf ? 'selected' : ''}>${uf}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Cidade</label><input type="text" id="edit-cidade" value="${esc(c.cidade || '')}" maxlength="80"></div>
      <div class="form-group"><label>Bairro</label><input type="text" id="edit-bairro" value="${esc(c.bairro || '')}" maxlength="80"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Logradouro</label><input type="text" id="edit-logradouro" value="${esc(c.logradouro || '')}" maxlength="120"></div>
      <div class="form-group"><label>Número</label><input type="text" id="edit-numero" value="${esc(c.numeroEndereco || '')}" maxlength="10"></div>
    </div>
    <div class="form-group"><label>Complemento</label><input type="text" id="edit-complemento" value="${esc(c.complemento || '')}" maxlength="60"></div>
    <button class="btn-primary" onclick="salvarEdicaoCliente(${c.id})">💾 Salvar Alterações</button>`;
}

async function autoPreencherCep() {
  const cep = document.getElementById('edit-cep')?.value;
  if (!cep) return;
  const data = await buscarCep(cep);
  if (!data) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && !el.value) el.value = val; };
  set('edit-logradouro', data.logradouro); set('edit-bairro', data.bairro);
  set('edit-cidade', data.localidade); set('edit-uf', data.uf); set('edit-complemento', data.complemento);
  toast('📍 Endereço preenchido!', 'info', 2000);
}

async function salvarEdicaoCliente(id) {
  clearErrors('edit-');
  const data = {
    nome: document.getElementById('edit-nome').value.trim(),
    cpfCnpj: document.getElementById('edit-cpf').value.trim(),
    email: document.getElementById('edit-email').value.trim(),
    telefone: document.getElementById('edit-telefone').value.trim(),
    whatsapp: document.getElementById('edit-whatsapp').value.trim() || null,
    dataNascimento: document.getElementById('edit-nascimento').value || null,
    rendaPresumida: parseFloat(document.getElementById('edit-renda').value) || null,
    cep: document.getElementById('edit-cep').value.trim() || null,
    logradouro: document.getElementById('edit-logradouro').value.trim() || null,
    numeroEndereco: document.getElementById('edit-numero').value.trim() || null,
    complemento: document.getElementById('edit-complemento').value.trim() || null,
    bairro: document.getElementById('edit-bairro').value.trim() || null,
    cidade: document.getElementById('edit-cidade').value.trim() || null,
    uf: document.getElementById('edit-uf').value || null,
    status: document.getElementById('edit-status').value,
  };
  let hasError = false;
  if (data.nome.length < 2) { showFieldError('edit-nome', 'Mínimo 2 caracteres'); hasError = true; }
  if (!data.cpfCnpj) { showFieldError('edit-cpf', 'CPF/CNPJ obrigatório'); hasError = true; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { showFieldError('edit-email', 'E-mail inválido'); hasError = true; }
  if (!data.telefone) { showFieldError('edit-telefone', 'Telefone obrigatório'); hasError = true; }
  if (hasError) return;

  try {
    const att = await API.atualizarCliente(id, data);
    currentCliente = att;
    renderClienteHeader(att);
    renderResumo(currentCobrancas, currentOcorrencias, att);
    toast('✅ Dados atualizados!', 'success');
    const idx = allClientes.findIndex(c => c.id === id);
    if (idx >= 0) allClientes[idx] = att;
  } catch (err) { toast(`❌ ${err.message}`, 'error'); }
}

// ============================================================
//  DASHBOARD
// ============================================================
async function loadDashboard() {
  showStatus('🔄 Carregando métricas...', 'info');
  try {
    const data = await API.dashboard();
    document.getElementById('dash-total-aberto').textContent = formatCurrency(data.totalEmAberto);
    document.getElementById('dash-total-recuperado').textContent = formatCurrency(data.totalRecuperado);
    document.getElementById('dash-quantidade').textContent = data.quantidadeCobrancas;
    document.getElementById('dash-taxa').textContent = `${data.taxaSucessoPercentual?.toFixed(1) ?? 0}%`;
    const pct = Math.min(100, Math.round(data.taxaSucessoPercentual ?? 0));
    document.getElementById('recovery-pct').textContent = `${pct}%`;
    setTimeout(() => { document.getElementById('recovery-fill').style.width = `${pct}%`; }, 100);
    hideStatus();
  } catch (err) {
    showStatus(`❌ ${err.message}`, 'error');
  }
  try {
    const recentes = await API.ocorrenciasRecentes();
    const el = document.getElementById('dash-ocorrencias-recentes');
    if (!recentes?.length) { el.innerHTML = '<p class="empty-state">Nenhuma ocorrência recente.</p>'; return; }
    el.innerHTML = recentes.map(o => {
      const tInfo = tipoOcorrenciaInfo(o.tipoOcorrencia);
      return `<div class="oc-item">
        <div class="oc-item-header"><span class="oc-item-cliente">${esc(o.cliente?.nome ?? '—')}</span><span>${tInfo.icon} ${formatDateTime(o.dataRegistro)}</span></div>
        <div class="oc-item-desc">${esc(o.descricao)}</div>
      </div>`;
    }).join('');
  } catch {}
}

// ============================================================
//  CADASTROS — lista de clientes (só gerente)
// ============================================================
async function loadClientesLista() {
  const el = document.getElementById('clientes-list');
  el.innerHTML = '<div class="empty-state">⏳ Carregando...</div>';
  try { allClientes = await API.listarClientes(); renderClientesLista(allClientes); }
  catch (err) { el.innerHTML = `<div class="empty-state">❌ ${esc(err.message)}</div>`; }
}

function renderClientesLista(clientes) {
  const el = document.getElementById('clientes-list');
  if (!clientes?.length) { el.innerHTML = '<div class="empty-state">Nenhum cliente cadastrado.</div>'; return; }
  el.innerHTML = clientes.map(c => {
    const sInfo = statusClienteInfo(c.status);
    return `<div class="table-row" data-id="${c.id}">
      <span data-label="Nome"><span class="row-name">${esc(c.nome)}</span></span>
      <span data-label="CPF/CNPJ">${esc(c.cpfCnpj || '—')}</span>
      <span data-label="E-mail"><span class="row-email">${esc(c.email)}</span></span>
      <span data-label="Status">${statusBadge(sInfo)}</span>
      <span data-label="Ações" class="row-actions">
        <button class="action-btn" onclick="irParaAtendimento(${c.id})" title="Atender">📞</button>
        <button class="action-btn" onclick="editClienteModal(${c.id})" title="Editar">✏️</button>
        <button class="action-btn danger" onclick="deleteCliente(${c.id})" title="Excluir">🗑️</button>
      </span>
    </div>`;
  }).join('');
}

function filterClientesLista(q) {
  const query = q.toLowerCase().trim();
  if (!query) return renderClientesLista(allClientes);
  renderClientesLista(allClientes.filter(c =>
    (c.nome || '').toLowerCase().includes(query) ||
    (c.cpfCnpj || '').toLowerCase().includes(query) ||
    (c.email || '').toLowerCase().includes(query)
  ));
}

function irParaAtendimento(id) {
  switchViewInternal('atendimento');
  setTimeout(() => abrirClienteNoConsole(id), 100);
}

// ============================================================
//  MODAL NOVO / EDITAR CLIENTE
// ============================================================
function showClienteFormModal(c=null) {
  const isEdit = !!c;
  const body = `
    <div class="form-group"><label>Nome *</label><input type="text" id="form-nome" value="${esc(c?.nome || '')}" maxlength="100"><div class="form-error hidden" id="err-nome"></div></div>
    <div class="form-row">
      <div class="form-group"><label>CPF/CNPJ *</label><input type="text" id="form-cpf" value="${esc(c?.cpfCnpj || '')}" maxlength="18" oninput="this.value=maskCpfCnpj(this.value)"><div class="form-error hidden" id="err-cpf"></div></div>
      <div class="form-group"><label>Status *</label><select id="form-status">${CONFIG.STATUS_CLIENTE.map(s => `<option value="${s.value}" ${c?.status === s.value ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>E-mail *</label><input type="email" id="form-email" value="${esc(c?.email || '')}" maxlength="150"><div class="form-error hidden" id="err-email"></div></div>
      <div class="form-group"><label>Telefone *</label><input type="text" id="form-telefone" value="${esc(c?.telephone || c?.telefone || '')}" maxlength="20" oninput="this.value=maskPhone(this.value)"><div class="form-error hidden" id="err-telefone"></div></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>WhatsApp</label><input type="text" id="form-whatsapp" value="${esc(c?.whatsapp || '')}" maxlength="20" oninput="this.value=maskPhone(this.value)"></div>
      <div class="form-group"><label>Data de Nascimento</label><input type="date" id="form-nascimento" value="${c?.dataNascimento || ''}"></div>
    </div>
    <div class="form-group"><label>Renda Presumida (R$)</label><input type="number" id="form-renda" step="0.01" min="0" value="${c?.rendaPresumida ?? ''}"></div>
    <div class="form-row">
      <div class="form-group"><label>CEP</label><input type="text" id="form-cep" value="${esc(c?.cep || '')}" maxlength="9" oninput="this.value=maskCep(this.value)" onblur="autoPreencherCepModal()"></div>
      <div class="form-group"><label>UF</label><select id="form-uf"><option value="">—</option>${CONFIG.UF_LIST.map(uf => `<option value="${uf}" ${c?.uf === uf ? 'selected' : ''}>${uf}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Cidade</label><input type="text" id="form-cidade" value="${esc(c?.cidade || '')}" maxlength="80"></div>
      <div class="form-group"><label>Bairro</label><input type="text" id="form-bairro" value="${esc(c?.bairro || '')}" maxlength="80"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Logradouro</label><input type="text" id="form-logradouro" value="${esc(c?.logradouro || '')}" maxlength="120"></div>
      <div class="form-group"><label>Número</label><input type="text" id="form-numero" value="${esc(c?.numeroEndereco || '')}" maxlength="10"></div>
    </div>
    <div class="form-group"><label>Complemento</label><input type="text" id="form-complemento" value="${esc(c?.complemento || '')}" maxlength="60"></div>`;

  openModal(isEdit ? 'Editar Cliente' : 'Novo Cliente', body, [
    { label: 'Cancelar', class: 'btn-ghost', onClick: closeModal },
    { label: isEdit ? '💾 Salvar' : '➕ Criar', class: 'btn-primary', onClick: () => saveClienteModal(c?.id ?? null) },
  ]);
}

async function autoPreencherCepModal() {
  const cep = document.getElementById('form-cep')?.value;
  if (!cep) return;
  const data = await buscarCep(cep);
  if (!data) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && !el.value) el.value = val; };
  set('form-logradouro', data.logradouro); set('form-bairro', data.bairro);
  set('form-cidade', data.localidade); set('form-uf', data.uf); set('form-complemento', data.complemento);
  toast('📍 Endereço preenchido!', 'info', 2000);
}

async function saveClienteModal(id) {
  clearErrors('');
  const data = {
    nome: document.getElementById('form-nome').value.trim(),
    cpfCnpj: document.getElementById('form-cpf').value.trim(),
    email: document.getElementById('form-email').value.trim(),
    telefone: document.getElementById('form-telefone').value.trim(),
    whatsapp: document.getElementById('form-whatsapp').value.trim() || null,
    dataNascimento: document.getElementById('form-nascimento').value || null,
    rendaPresumida: parseFloat(document.getElementById('form-renda').value) || null,
    cep: document.getElementById('form-cep').value.trim() || null,
    logradouro: document.getElementById('form-logradouro').value.trim() || null,
    numeroEndereco: document.getElementById('form-numero').value.trim() || null,
    complemento: document.getElementById('form-complemento').value.trim() || null,
    bairro: document.getElementById('form-bairro').value.trim() || null,
    cidade: document.getElementById('form-cidade').value.trim() || null,
    uf: document.getElementById('form-uf').value || null,
    status: document.getElementById('form-status').value,
  };
  let hasError = false;
  if (data.nome.length < 2) { showFieldError('nome', 'Mínimo 2 caracteres'); hasError = true; }
  if (!data.cpfCnpj) { showFieldError('cpf', 'CPF/CNPJ obrigatório'); hasError = true; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { showFieldError('email', 'E-mail inválido'); hasError = true; }
  if (!data.telefone) { showFieldError('telefone', 'Telefone obrigatório'); hasError = true; }
  if (hasError) return;

  try {
    if (id) { await API.atualizarCliente(id, data); toast('✅ Cliente atualizado!', 'success'); }
    else    { await API.criarCliente(data); toast('✅ Cliente criado!', 'success'); }
    closeModal();
    loadClientesLista();
  } catch (err) { toast(`❌ ${err.message}`, 'error'); }
}

async function editClienteModal(id) {
  try { const c = await API.buscarCliente(id); showClienteFormModal(c); }
  catch (err) { toast(`❌ ${err.message}`, 'error'); }
}

// ============================================================
//  EXCLUIR CLIENTE — corrigido + RBAC
// ============================================================
function deleteCliente(id) {
  if (!can('canDelete')) {
    toast('⛔ Apenas gerentes podem excluir clientes.', 'error'); return;
  }
  openModal('Confirmar Exclusão',
    '<p style="font-size:.9rem;line-height:1.6">Excluir este cliente?<br><strong>Todas as cobranças e ocorrências vinculadas</strong> também serão removidas.<br>Esta ação é irreversível.</p>',
    [
      { label: 'Cancelar', class: 'btn-ghost', onClick: closeModal },
      { label: '🗑️ Excluir', class: 'btn-danger', onClick: () => confirmDeleteCliente(id) },
    ]
  );
}

async function confirmDeleteCliente(id) {
  const btnExcluir = document.querySelector('#modal-footer .btn-danger');
  if (btnExcluir) { btnExcluir.disabled = true; btnExcluir.textContent = 'Excluindo...'; }

  try {
    await API.deletarCliente(id);
    toast('✅ Cliente excluído com sucesso.', 'success');
    closeModal();
    allClientes = allClientes.filter(c => c.id !== id);
    loadClientesLista();
  } catch (err) {
    toast(`❌ Falha ao excluir: ${err.message}`, 'error');
    if (btnExcluir) { btnExcluir.disabled = false; btnExcluir.textContent = '🗑️ Excluir'; }
  }
}

// ============================================================
//  EVENT LISTENERS
// ============================================================
function initEvents() {
  // Nav
  document.querySelectorAll('.nav-tab').forEach(t =>
    t.addEventListener('click', () => switchView(t.dataset.view))
  );
  document.querySelectorAll('.inner-tab').forEach(t =>
    t.addEventListener('click', () => switchInnerTab(t.dataset.inner))
  );

  // Console de atendimento
  document.getElementById('btn-buscar-cliente').addEventListener('click', buscarClienteConsole);
  document.getElementById('search-cpf').addEventListener('keydown', e => { if (e.key === 'Enter') buscarClienteConsole(); });

  // Cobranças
  document.getElementById('btn-nova-cobranca').addEventListener('click', () => showCobrancaForm());

  // Ocorrências
  document.getElementById('btn-registrar-ocorrencia').addEventListener('click', registrarOcorrencia);
  const ocTextarea = document.getElementById('oc-descricao');
  ocTextarea.addEventListener('input', () => {
    const len = ocTextarea.value.length;
    document.getElementById('oc-char-count').textContent = len;
    document.getElementById('btn-registrar-ocorrencia').disabled = len < 10;
  });
  document.getElementById('oc-compromisso').addEventListener('change', e => {
    const ok = e.target.value === 'true';
    document.getElementById('oc-data-compromisso').disabled = !ok;
    document.getElementById('oc-valor-acordo').disabled = !ok;
    if (!ok) { document.getElementById('oc-data-compromisso').value = ''; document.getElementById('oc-valor-acordo').value = ''; }
  });

  // Cadastros
  document.getElementById('btn-novo-cliente').addEventListener('click', () => showClienteFormModal());
  document.getElementById('search-cliente-lista').addEventListener('input', e => filterClientesLista(e.target.value));

  // Login
  document.getElementById('btn-login').addEventListener('click', fazerLogin);
  document.getElementById('login-senha').addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); });

  // Modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

window.addEventListener('DOMContentLoaded', () => {
  initEvents();
  loadSession();
  if (isLogged()) {
    showApp();
    // Pré-carrega lista para gerente
    if (currentUser?.role === 'GERENTE') {
      API.listarClientes().then(d => { allClientes = d; }).catch(() => {});
    }
  } else {
    showLoginScreen();
  }
});

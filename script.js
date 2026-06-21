/* ============================================================
   SCRIPT.JS — CrediControl v3.0 | Console de Atendimento
   Models atualizados: Cliente (CPF, endereço, etc),
   Cobranca (empresa, contrato, valores), Ocorrencia (tipo, resultado)
   ============================================================ */

// ============================================================
//  API LAYER
// ============================================================
const API = (() => {
  const BASE = CONFIG.API_BASE_URL;
  async function request(path, { method = 'GET', body, headers } = {}) {
    const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = `Erro ${res.status}`;
      try { const j = JSON.parse(text); if (j.message) msg = j.message;
        if (j.errors?.length) msg = j.errors.map(e => e.defaultMessage || e.message).join('; ');
      } catch {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }
  return {
    listarClientes:      () => request(CONFIG.ENDPOINTS.CLIENTES),
    buscarCliente:       (id) => request(CONFIG.ENDPOINTS.CLIENTE_BY_ID(id)),
    criarCliente:        (d) => request(CONFIG.ENDPOINTS.CLIENTES, { method:'POST', body:d }),
    atualizarCliente:    (id,d) => request(CONFIG.ENDPOINTS.CLIENTE_BY_ID(id), { method:'PUT', body:d }),
    deletarCliente:      (id) => request(CONFIG.ENDPOINTS.CLIENTE_BY_ID(id), { method:'DELETE' }),
    listarCobrancas:     (p=0,s=50) => request(`${CONFIG.ENDPOINTS.COBRANCAS}?page=${p}&size=${s}`),
    buscarCobranca:      (id) => request(CONFIG.ENDPOINTS.COBRANCA_BY_ID(id)),
    criarCobranca:       (d) => request(CONFIG.ENDPOINTS.COBRANCAS, { method:'POST', body:d }),
    atualizarCobranca:   (id,d) => request(CONFIG.ENDPOINTS.COBRANCA_BY_ID(id), { method:'PUT', body:d }),
    cobrancasPorCliente: (id) => request(CONFIG.ENDPOINTS.COBRANCA_POR_CLIENTE(id)),
    dashboard:           () => request(CONFIG.ENDPOINTS.DASHBOARD),
    criarOcorrencia:     (cid,d) => request(CONFIG.ENDPOINTS.OCORRENCIA_CRIAR(cid), { method:'POST', body:d }),
    listarOcorrencias:   (cid) => request(CONFIG.ENDPOINTS.OCORRENCIA_LISTAR(cid)),
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
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateY(20px)'; el.style.transition='all .3s'; setTimeout(()=>el.remove(),300); }, dur);
}
function showStatus(msg, type='info') { const b=document.getElementById('status-banner'); b.textContent=msg; b.className=`status-banner ${type}`; b.classList.remove('hidden'); }
function hideStatus() { document.getElementById('status-banner').classList.add('hidden'); }
function openModal(title, body, footer='') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-footer').innerHTML = footer;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }
function esc(s) { const d=document.createElement('div'); d.textContent=String(s??'—'); return d.innerHTML; }
function statusBadge(info) { return `<span class="status-badge" style="background:${info.color}22;color:${info.color};border:1px solid ${info.color}44">${info.icon} ${info.label}</span>`; }
function showFieldError(f,m) { const e=document.getElementById(`err-${f}`); if(e){e.textContent=m;e.classList.remove('hidden');} }
function clearErrors(prefix) { document.querySelectorAll(`[id^="err-${prefix}"]`).forEach(e=>{e.textContent='';e.classList.add('hidden');}); }

// ─── Preenche selects de enum dinamicamente ───
function fillSelect(elId, enumArr, placeholder='Selecione...') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `<option value="">${placeholder}</option>` +
    enumArr.map(o => `<option value="${o.value}">${o.icon} ${o.label}</option>`).join('');
}

// ============================================================
//  NAVEGAÇÃO
// ============================================================
function switchView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelector(`.nav-tab[data-view="${name}"]`).classList.add('active');
  if (name==='dashboard') loadDashboard();
  if (name==='cadastros') loadClientesLista();
}
function switchInnerTab(name) {
  document.querySelectorAll('.inner-tab').forEach(t=>t.classList.remove('active'));
  document.querySelector(`.inner-tab[data-inner="${name}"]`).classList.add('active');
  document.querySelectorAll('.inner-view').forEach(v=>v.classList.remove('active'));
  document.getElementById(`inner-${name}`).classList.add('active');
}

// ============================================================
//  CONSOLE DE ATENDIMENTO — BUSCA
// ============================================================
let allClientes = [];
let currentCliente = null;
let currentCobrancas = [];
let currentOcorrencias = [];

async function buscarClienteConsole() {
  const query = document.getElementById('search-cpf').value.trim();
  if (!query) { toast('Digite um CPF/CNPJ ou nome para buscar.', 'error'); return; }

  showStatus('🔍 Buscando cliente...', 'info');
  document.getElementById('cliente-card').classList.add('hidden');
  document.getElementById('empty-attendance').classList.add('hidden');

  try {
    if (allClientes.length === 0) allClientes = await API.listarClientes();

    const q = query.toLowerCase().replace(/[.\-\/]/g, '');
    const found = allClientes.filter(c => {
      const nome = (c.nome||'').toLowerCase();
      const email = (c.email||'').toLowerCase();
      const cpf = (c.cpfCnpj||'').toLowerCase().replace(/[.\-\/]/g, '');
      const tel = (c.telephone||c.telefone||'').replace(/\D/g, '');
      return nome.includes(query.toLowerCase()) ||
             email.includes(query.toLowerCase()) ||
             cpf.includes(q) ||
             tel.includes(q);
    });

    if (found.length === 0) {
      showStatus('❌ Nenhum cliente encontrado.', 'error');
      document.getElementById('empty-attendance').classList.remove('hidden');
      return;
    }
    hideStatus();
    if (found.length === 1) await abrirClienteNoConsole(found[0].id);
    else mostrarMultiplusResultados(found);
  } catch (err) {
    const isCors = err.message.includes('Failed to fetch') || err.message.includes('NetworkError');
    showStatus(isCors ? '⚠️ API não conecta. Spring Boot rodando em localhost:8080?' : `❌ ${err.message}`, 'error');
    document.getElementById('empty-attendance').classList.remove('hidden');
  }
}

function mostrarMultiplusResultados(resultados) {
  const empty = document.getElementById('empty-attendance');
  empty.classList.remove('hidden');
  empty.innerHTML = `
    <div class="empty-attendance-icon">👥</div>
    <p class="empty-attendance-title">${resultados.length} clientes encontrados</p>
    <p class="empty-attendance-sub">Clique em um cliente para abrir o atendimento:</p>
    <div class="multi-result-list">
      ${resultados.map(c => `
        <button class="multi-result-item" onclick="abrirClienteNoConsole(${c.id})">
          <span class="multi-result-avatar">👤</span>
          <span class="multi-result-info">
            <strong>${esc(c.nome)}</strong>
            <small>${esc(c.cpfCnpj||'—')} • ${esc(c.email)}</small>
          </span>
          ${statusBadge(statusClienteInfo(c.status))}
        </button>`).join('')}
    </div>`;
}

// ─── Abre cliente no console ───
async function abrirClienteNoConsole(id) {
  showStatus('🔄 Carregando dados do cliente...', 'info');
  try {
    const cliente = await API.buscarCliente(id);
    currentCliente = cliente;
    const [cobRes, ocRes] = await Promise.allSettled([
      API.cobrancasPorCliente(id),
      API.listarOcorrencias(id),
    ]);
    currentCobrancas = cobRes.status==='fulfilled' ? (cobRes.value||[]) : [];
    currentOcorrencias = ocRes.status==='fulfilled' ? (ocRes.value||[]) : [];
    hideStatus();

    document.getElementById('empty-attendance').classList.add('hidden');
    document.getElementById('cliente-card').classList.remove('hidden');

    renderClienteHeader(cliente);
    renderResumo(currentCobrancas, currentOcorrencias, cliente);
    renderCobrancasCliente(currentCobrancas);
    renderOcorrenciasCliente(currentOcorrencias);
    renderEditForm(cliente);

    // Preenche selects de ocorrência
    fillSelect('oc-tipo', CONFIG.TIPO_OCORRENCIA, 'Selecione o tipo...');
    fillSelect('oc-resultado', CONFIG.RESULTADO_OCORRENCIA, 'Selecione o resultado...');

    switchInnerTab('resumo');
    document.getElementById('cliente-card').scrollIntoView({ behavior:'smooth', block:'start' });
  } catch (err) { showStatus(`❌ ${err.message}`, 'error'); }
}

function renderClienteHeader(c) {
  document.getElementById('cliente-avatar').textContent = '👤';
  document.getElementById('cliente-nome').textContent = c.nome;
  document.getElementById('cliente-cpf').textContent = c.cpfCnpj || '—';
  document.getElementById('cliente-email').textContent = c.email;
  document.getElementById('cliente-telefone').textContent = c.telephone || c.telefone || '—';
  document.getElementById('cliente-status-wrap').innerHTML = statusBadge(statusClienteInfo(c.status));
}

// ─── ABA: RESUMO ───
function renderResumo(cobrancas, ocorrencias, cliente) {
  const totalDebito = cobrancas.filter(c=>c.status!=='PAGO').reduce((s,c)=>s+Number(c.valor||0),0);
  const totalPago = cobrancas.filter(c=>c.status==='PAGO').reduce((s,c)=>s+Number(c.valor||0),0);
  const ativas = cobrancas.filter(c=>c.status!=='PAGO'&&c.status!=='JUDICIAL').length;

  document.getElementById('resumo-total-debito').textContent = formatCurrency(totalDebito);
  document.getElementById('resumo-total-pago').textContent = formatCurrency(totalPago);
  document.getElementById('resumo-cobrancas-ativas').textContent = ativas;
  document.getElementById('resumo-total-ocorrencias').textContent = ocorrencias.length;

  // Dados pessoais + endereço
  const dadosEl = document.getElementById('resumo-dados-pessoais');
  const endereco = [
    cliente.logradouro, cliente.numeroEndereco,
    cliente.complemento, cliente.bairro,
    cliente.cidade, cliente.uf
  ].filter(Boolean).join(', ');

  dadosEl.innerHTML = `
    <div class="dados-grid">
      <div class="dados-row"><span class="dados-label">CPF/CNPJ</span><span class="dados-value">${esc(cliente.cpfCnpj||'—')}</span></div>
      <div class="dados-row"><span class="dados-label">WhatsApp</span><span class="dados-value">${esc(cliente.whatsapp||'—')}</span></div>
      <div class="dados-row"><span class="dados-label">Nascimento</span><span class="dados-value">${formatDate(cliente.dataNascimento)}</span></div>
      <div class="dados-row"><span class="dados-label">Renda Presumida</span><span class="dados-value">${cliente.rendaPresumida ? formatCurrency(cliente.rendaPresumida) : '—'}</span></div>
      <div class="dados-row"><span class="dados-label">CEP</span><span class="dados-value">${esc(cliente.cep||'—')}</span></div>
      <div class="dados-row dados-row-full"><span class="dados-label">Endereço</span><span class="dados-value">${esc(endereco||'—')}</span></div>
    </div>`;

  // Ocorrências recentes (3)
  const recentes = ocorrencias.slice(0,3);
  const el = document.getElementById('resumo-ocorrencias');
  el.innerHTML = recentes.length === 0
    ? '<p class="empty-state">Nenhuma ocorrência registrada.</p>'
    : recentes.map(o => {
        const tInfo = tipoOcorrenciaInfo(o.tipoOcorrencia);
        const rInfo = resultadoOcorrenciaInfo(o.resultadoOcorrencia);
        return `<div class="oc-item">
          <div class="oc-item-header">
            <span>${tInfo.icon} ${tInfo.label}${rInfo.value ? ` → ${rInfo.icon} ${rInfo.label}` : ''}</span>
            <span>${formatDateTime(o.dataRegistro)}</span>
          </div>
          <div class="oc-item-desc">${esc(o.descricao)}</div>
          ${o.gerouCompromisso ? `<div class="oc-tag">🤞 Promessa: ${formatDate(o.dataCompromisso)}${o.valorAcordo ? ` • ${formatCurrency(o.valorAcordo)}` : ''}</div>` : ''}
        </div>`;
      }).join('');
}

// ─── ABA: COBRANÇAS ───
function renderCobrancasCliente(cobrancas) {
  const el = document.getElementById('cliente-cobrancas-list');
  if (!cobrancas?.length) { el.innerHTML = '<div class="empty-state">Nenhuma cobrança registrada.</div>'; return; }
  el.innerHTML = cobrancas.map(c => {
    const cInfo = statusCobrancaInfo(c.status);
    const fInfo = c.formaPagamento ? formaPagamentoInfo(c.formaPagamento) : null;
    const desconto = c.valorOriginal && Number(c.valorOriginal) > Number(c.valor)
      ? `<span class="cobranca-desconto">De ${formatCurrency(c.valorOriginal)}</span>` : '';
    return `
      <div class="cobranca-item" data-id="${c.id}">
        <div class="cobranca-item-top">
          <div class="cobranca-item-info">
            <span class="cobranca-item-desc">${esc(c.descricao)}</span>
            ${c.empresaCredora ? `<span class="cobranca-item-empresa">🏢 ${esc(c.empresaCredora)}</span>` : ''}
            ${c.numeroContrato ? `<span class="cobranca-item-contrato">📄 Contrato: ${esc(c.numeroContrato)}</span>` : ''}
            ${c.categoriaDebito ? `<span class="cobranca-item-categoria">🏷️ ${esc(c.categoriaDebito)}</span>` : ''}
          </div>
          <span class="cobranca-item-valor">${formatCurrency(c.valor)} ${desconto}</span>
        </div>
        <div class="cobranca-item-meta">
          <span>📅 Venc.: ${formatDate(c.dataVencimento)}</span>
          ${c.dataPagamento ? `<span>✅ Pago em: ${formatDate(c.dataPagamento)}</span>` : ''}
          ${fInfo ? `<span>${fInfo.icon} ${fInfo.label}</span>` : ''}
          ${c.codigoAcordo ? `<span>🔗 Acordo: ${esc(c.codigoAcordo)}</span>` : ''}
        </div>
        ${c.observacoes ? `<div class="cobranca-obs">📝 ${esc(c.observacoes)}</div>` : ''}
        <div class="cobranca-item-actions">
          <select class="cobranca-status-select" onchange="alterarStatusCobranca(${c.id}, this.value)">
            ${CONFIG.STATUS_COBRANCA.map(s => `<option value="${s.value}" ${c.status===s.value?'selected':''}>${s.icon} ${s.label}</option>`).join('')}
          </select>
          <button class="action-btn" onclick="editCobranca(${c.id})" title="Editar">✏️</button>
        </div>
      </div>`;
  }).join('');
}

async function alterarStatusCobranca(id, novoStatus) {
  try {
    const cobranca = currentCobrancas.find(c=>c.id===id);
    if (!cobranca) return;
    await API.atualizarCobranca(id, { ...cobranca, status:novoStatus, cliente:{id:currentCliente.id} });
    cobranca.status = novoStatus;
    if (novoStatus==='PAGO' && !cobranca.dataPagamento) cobranca.dataPagamento = new Date().toISOString().split('T')[0];
    toast(`✅ Status alterado para "${statusCobrancaInfo(novoStatus).label}"`, 'success');
    renderResumo(currentCobrancas, currentOcorrencias, currentCliente);
  } catch (err) { toast(`❌ ${err.message}`, 'error'); }
}

// ─── Modal de Cobrança (com todos os campos novos) ───
function showCobrancaForm(cobranca=null) {
  const isEdit = !!cobranca;
  const body = `
    <div class="form-row">
      <div class="form-group">
        <label>Nº do Contrato</label>
        <input type="text" id="form-cob-contrato" value="${esc(cobranca?.numeroContrato||'')}" placeholder="Ex: 2024-00123">
      </div>
      <div class="form-group">
        <label>Empresa Credora *</label>
        <input type="text" id="form-cob-empresa" value="${esc(cobranca?.empresaCredora||'')}" maxlength="100" placeholder="Ex: Banco XYZ">
        <div class="form-error hidden" id="err-cob-empresa"></div>
      </div>
    </div>
    <div class="form-group">
      <label>Descrição * (5–255 chars)</label>
      <textarea id="form-cob-descricao" rows="2" maxlength="255" placeholder="Descrição do débito">${esc(cobranca?.descricao||'')}</textarea>
      <div class="form-error hidden" id="err-cob-descricao"></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Categoria do Débito</label>
        <select id="form-cob-categoria">
          <option value="">Selecione...</option>
          ${CONFIG.CATEGORIAS_DEBITO.map(cat => `<option value="${cat}" ${cobranca?.categoriaDebito===cat?'selected':''}>${cat}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Status *</label>
        <select id="form-cob-status">
          ${CONFIG.STATUS_COBRANCA.map(s => `<option value="${s.value}" ${cobranca?.status===s.value?'selected':''}>${s.icon} ${s.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Valor Atual *</label>
        <input type="number" id="form-cob-valor" step="0.01" min="0.01" value="${cobranca?.valor??''}" placeholder="0,00">
        <div class="form-error hidden" id="err-cob-valor"></div>
      </div>
      <div class="form-group">
        <label>Valor Original</label>
        <input type="number" id="form-cob-valor-original" step="0.01" min="0" value="${cobranca?.valorOriginal??''}" placeholder="Antes do desconto">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Multa (R$)</label>
        <input type="number" id="form-cob-multa" step="0.01" min="0" value="${cobranca?.valorMulta??''}" placeholder="0,00">
      </div>
      <div class="form-group">
        <label>Juros (R$)</label>
        <input type="number" id="form-cob-juros" step="0.01" min="0" value="${cobranca?.valorJuros??''}" placeholder="0,00">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Vencimento *</label>
        <input type="date" id="form-cob-vencimento" value="${cobranca?.dataVencimento||''}">
        <div class="form-error hidden" id="err-cob-vencimento"></div>
      </div>
      <div class="form-group">
        <label>Forma de Pagamento</label>
        <select id="form-cob-forma-pag">
          <option value="">Selecione...</option>
          ${CONFIG.FORMA_PAGAMENTO.map(f => `<option value="${f.value}" ${cobranca?.formaPagamento===f.value?'selected':''}>${f.icon} ${f.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Código do Acordo</label>
        <input type="text" id="form-cob-acordo" value="${esc(cobranca?.codigoAcordo||'')}" placeholder="Ex: AC-2024-001">
      </div>
      <div class="form-group">
        <label>Data de Pagamento</label>
        <input type="date" id="form-cob-data-pag" value="${cobranca?.dataPagamento||''}">
      </div>
    </div>
    <div class="form-group">
      <label>Observações</label>
      <textarea id="form-cob-obs" rows="2" maxlength="500" placeholder="Notas internas do operador">${esc(cobranca?.observacoes||'')}</textarea>
    </div>`;
  const footer = `
    <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn-primary" onclick="saveCobranca(${cobranca?.id??'null'})">${isEdit?'💾 Salvar':'➕ Criar'}</button>`;
  openModal(isEdit?'Editar Cobrança':'Nova Cobrança', body, footer);
}

async function saveCobranca(id) {
  clearErrors('cob-');
  const data = {
    numeroContrato:  document.getElementById('form-cob-contrato').value.trim() || null,
    empresaCredora:  document.getElementById('form-cob-empresa').value.trim(),
    descricao:       document.getElementById('form-cob-descricao').value.trim(),
    categoriaDebito: document.getElementById('form-cob-categoria').value || null,
    status:          document.getElementById('form-cob-status').value,
    valor:           parseFloat(document.getElementById('form-cob-valor').value),
    valorOriginal:   parseFloat(document.getElementById('form-cob-valor-original').value) || null,
    valorMulta:      parseFloat(document.getElementById('form-cob-multa').value) || null,
    valorJuros:      parseFloat(document.getElementById('form-cob-juros').value) || null,
    dataVencimento:  document.getElementById('form-cob-vencimento').value || null,
    formaPagamento:  document.getElementById('form-cob-forma-pag').value || null,
    codigoAcordo:    document.getElementById('form-cob-acordo').value.trim() || null,
    dataPagamento:   document.getElementById('form-cob-data-pag').value || null,
    observacoes:     document.getElementById('form-cob-obs').value.trim() || null,
    cliente:         { id: currentCliente.id },
  };

  let hasError = false;
  if (!data.empresaCredora) { showFieldError('cob-empresa','Empresa credora é obrigatória'); hasError=true; }
  if (data.descricao.length < 5) { showFieldError('cob-descricao','Mínimo 5 caracteres'); hasError=true; }
  if (!data.valor || data.valor <= 0) { showFieldError('cob-valor','Valor deve ser maior que zero'); hasError=true; }
  if (!data.dataVencimento) { showFieldError('cob-vencimento','Vencimento é obrigatório'); hasError=true; }
  if (hasError) return;

  try {
    if (id) { await API.atualizarCobranca(id, data); toast('✅ Cobrança atualizada!', 'success'); }
    else    { await API.criarCobranca(data); toast('✅ Cobrança criada!', 'success'); }
    closeModal();
    const lista = await API.cobrancasPorCliente(currentCliente.id);
    currentCobrancas = lista;
    renderCobrancasCliente(lista);
    renderResumo(currentCobrancas, currentOcorrencias, currentCliente);
  } catch (err) { toast(`❌ ${err.message}`, 'error'); }
}

async function editCobranca(id) {
  try { const c = await API.buscarCobranca(id); showCobrancaForm(c); }
  catch (err) { toast(`❌ ${err.message}`, 'error'); }
}

// ─── ABA: OCORRÊNCIAS ───
function renderOcorrenciasCliente(ocorrencias) {
  const el = document.getElementById('cliente-ocorrencias-list');
  if (!ocorrencias?.length) { el.innerHTML = '<p class="empty-state">Nenhuma ocorrência registrada.</p>'; return; }
  el.innerHTML = ocorrencias.map(o => {
    const tInfo = tipoOcorrenciaInfo(o.tipoOcorrencia);
    const rInfo = resultadoOcorrenciaInfo(o.resultadoOcorrencia);
    return `<div class="oc-item">
      <div class="oc-item-header">
        <span>${tInfo.icon} ${tInfo.label}${rInfo.value ? ` → ${rInfo.icon} ${rInfo.label}` : ''}</span>
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
  if (descricao.length < 10) { toast('Descrição deve ter no mínimo 10 caracteres.', 'error'); return; }

  const tipoOcorrencia = document.getElementById('oc-tipo').value;
  if (!tipoOcorrencia) { toast('Selecione o tipo de contato.', 'error'); return; }

  const gerouCompromisso = document.getElementById('oc-compromisso').value === 'true';
  const dataCompromisso = gerouCompromisso ? document.getElementById('oc-data-compromisso').value || null : null;
  const valorAcordoRaw = document.getElementById('oc-valor-acordo').value;
  const valorAcordo = valorAcordoRaw ? parseFloat(valorAcordoRaw) : null;

  const data = {
    descricao,
    tipoOcorrencia,
    resultadoOcorrencia: document.getElementById('oc-resultado').value || null,
    gerouCompromisso,
    dataCompromisso,
    valorAcordo,
    cliente: { id: currentCliente.id },
  };

  try {
    await API.criarOcorrencia(currentCliente.id, data);
    toast('✅ Ocorrência registrada!', 'success');
    // Limpa form
    document.getElementById('oc-descricao').value = '';
    document.getElementById('oc-char-count').textContent = '0';
    document.getElementById('oc-tipo').value = '';
    document.getElementById('oc-resultado').value = '';
    document.getElementById('oc-compromisso').value = 'false';
    document.getElementById('oc-data-compromisso').value = '';
    document.getElementById('oc-valor-acordo').value = '';
    document.getElementById('oc-data-compromisso').disabled = true;
    document.getElementById('oc-valor-acordo').disabled = true;
    document.getElementById('btn-registrar-ocorrencia').disabled = true;
    // Recarrega
    const lista = await API.listarOcorrencias(currentCliente.id);
    currentOcorrencias = lista;
    renderOcorrenciasCliente(lista);
    renderResumo(currentCobrancas, currentOcorrencias, currentCliente);
  } catch (err) { toast(`❌ ${err.message}`, 'error'); }
}

// ─── ABA: EDITAR CLIENTE (inline com todos os campos) ───
function renderEditForm(c) {
  const container = document.getElementById('edit-form-container');
  container.innerHTML = `
    <div class="form-group">
      <label>Nome *</label>
      <input type="text" id="edit-nome" value="${esc(c.nome)}" maxlength="100">
      <div class="form-error hidden" id="err-edit-nome"></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>CPF/CNPJ *</label>
        <input type="text" id="edit-cpf" value="${esc(c.cpfCnpj||'')}" maxlength="18" oninput="this.value=maskCpfCnpj(this.value)">
        <div class="form-error hidden" id="err-edit-cpf"></div>
      </div>
      <div class="form-group">
        <label>Status *</label>
        <select id="edit-status">
          ${CONFIG.STATUS_CLIENTE.map(s => `<option value="${s.value}" ${c.status===s.value?'selected':''}>${s.icon} ${s.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>E-mail *</label>
        <input type="email" id="edit-email" value="${esc(c.email)}" maxlength="150">
        <div class="form-error hidden" id="err-edit-email"></div>
      </div>
      <div class="form-group">
        <label>Telefone *</label>
        <input type="text" id="edit-telefone" value="${esc(c.telephone||c.telefone)}" maxlength="20" oninput="this.value=maskPhone(this.value)">
        <div class="form-error hidden" id="err-edit-telefone"></div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>WhatsApp</label>
        <input type="text" id="edit-whatsapp" value="${esc(c.whatsapp||'')}" maxlength="20" oninput="this.value=maskPhone(this.value)">
      </div>
      <div class="form-group">
        <label>Data de Nascimento</label>
        <input type="date" id="edit-nascimento" value="${c.dataNascimento||''}">
      </div>
    </div>
    <div class="form-group">
      <label>Renda Presumida (R$)</label>
      <input type="number" id="edit-renda" step="0.01" min="0" value="${c.rendaPresumida??''}" placeholder="0,00">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>CEP</label>
        <input type="text" id="edit-cep" value="${esc(c.cep||'')}" maxlength="9" oninput="this.value=maskCep(this.value)" onblur="autoPreencherCep()">
      </div>
      <div class="form-group">
        <label>UF</label>
        <select id="edit-uf">
          <option value="">—</option>
          ${CONFIG.UF_LIST.map(uf => `<option value="${uf}" ${c.uf===uf?'selected':''}>${uf}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Cidade</label>
        <input type="text" id="edit-cidade" value="${esc(c.cidade||'')}" maxlength="80">
      </div>
      <div class="form-group">
        <label>Bairro</label>
        <input type="text" id="edit-bairro" value="${esc(c.bairro||'')}" maxlength="80">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Logradouro</label>
        <input type="text" id="edit-logradouro" value="${esc(c.logradouro||'')}" maxlength="120">
      </div>
      <div class="form-group">
        <label>Número</label>
        <input type="text" id="edit-numero" value="${esc(c.numeroEndereco||'')}" maxlength="10">
      </div>
    </div>
    <div class="form-group">
      <label>Complemento</label>
      <input type="text" id="edit-complemento" value="${esc(c.complemento||'')}" maxlength="60">
    </div>
    <button class="btn-primary" onclick="salvarEdicaoCliente(${c.id})">💾 Salvar Alterações</button>`;
}

// ─── Auto-preencher endereço via CEP ───
async function autoPreencherCep() {
  const cep = document.getElementById('edit-cep')?.value;
  if (!cep) return;
  const data = await buscarCep(cep);
  if (!data) return;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && !el.value) el.value = val; };
  setVal('edit-logradouro', data.logradouro);
  setVal('edit-bairro', data.bairro);
  setVal('edit-cidade', data.localidade);
  setVal('edit-uf', data.uf);
  setVal('edit-complemento', data.complemento);
  toast('📍 Endereço auto-preenchido pelo CEP!', 'info', 2000);
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
  if (data.nome.length < 2) { showFieldError('edit-nome','Mínimo 2 caracteres'); hasError=true; }
  if (!data.cpfCnpj) { showFieldError('edit-cpf','CPF/CNPJ é obrigatório'); hasError=true; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { showFieldError('edit-email','E-mail inválido'); hasError=true; }
  if (!data.telefone) { showFieldError('edit-telefone','Telefone é obrigatório'); hasError=true; }
  if (hasError) return;

  try {
    const att = await API.atualizarCliente(id, data);
    currentCliente = att;
    renderClienteHeader(att);
    renderResumo(currentCobrancas, currentOcorrencias, att);
    toast('✅ Dados do cliente atualizados!', 'success');
    const idx = allClientes.findIndex(c=>c.id===id);
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
    const isCors = err.message.includes('Failed to fetch') || err.message.includes('NetworkError');
    showStatus(isCors ? '⚠️ API não conecta. Spring Boot rodando em localhost:8080?' : `❌ ${err.message}`, 'error');
  }
  try {
    const recentes = await API.ocorrenciasRecentes();
    const el = document.getElementById('dash-ocorrencias-recentes');
    if (!recentes?.length) { el.innerHTML = '<p class="empty-state">Nenhuma ocorrência recente.</p>'; return; }
    el.innerHTML = recentes.map(o => {
      const tInfo = tipoOcorrenciaInfo(o.tipoOcorrencia);
      return `<div class="oc-item">
        <div class="oc-item-header">
          <span class="oc-item-cliente">${esc(o.cliente?.nome ?? '—')}</span>
          <span>${tInfo.icon} ${formatDateTime(o.dataRegistro)}</span>
        </div>
        <div class="oc-item-desc">${esc(o.descricao)}</div>
      </div>`;
    }).join('');
  } catch {}
}

// ============================================================
//  CADASTROS — LISTA + MODAL NOVO CLIENTE
// ============================================================
async function loadClientesLista() {
  const el = document.getElementById('clientes-list');
  el.innerHTML = '<div class="empty-state"><span class="spinner"></span> Carregando...</div>';
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
      <span data-label="CPF/CNPJ">${esc(c.cpfCnpj||'—')}</span>
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

function filterClientesLista(query) {
  const q = query.toLowerCase().trim();
  if (!q) return renderClientesLista(allClientes);
  renderClientesLista(allClientes.filter(c =>
    (c.nome||'').toLowerCase().includes(q) ||
    (c.cpfCnpj||'').toLowerCase().includes(q) ||
    (c.email||'').toLowerCase().includes(q) ||
    (c.telephone||c.telefone||'').toLowerCase().includes(q)
  ));
}

function irParaAtendimento(id) { switchView('atendimento'); setTimeout(()=>abrirClienteNoConsole(id), 100); }

// ─── Modal Novo/Editar Cliente (completo) ───
function showClienteFormModal(c=null) {
  const isEdit = !!c;
  const body = `
    <div class="form-group">
      <label>Nome *</label>
      <input type="text" id="form-nome" value="${esc(c?.nome||'')}" maxlength="100">
      <div class="form-error hidden" id="err-nome"></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>CPF/CNPJ *</label>
        <input type="text" id="form-cpf" value="${esc(c?.cpfCnpj||'')}" maxlength="18" oninput="this.value=maskCpfCnpj(this.value)">
        <div class="form-error hidden" id="err-cpf"></div>
      </div>
      <div class="form-group">
        <label>Status *</label>
        <select id="form-status">
          ${CONFIG.STATUS_CLIENTE.map(s => `<option value="${s.value}" ${c?.status===s.value?'selected':''}>${s.icon} ${s.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>E-mail *</label>
        <input type="email" id="form-email" value="${esc(c?.email||'')}" maxlength="150">
        <div class="form-error hidden" id="err-email"></div>
      </div>
      <div class="form-group">
        <label>Telefone *</label>
        <input type="text" id="form-telefone" value="${esc(c?.telephone||c?.telefone||'')}" maxlength="20" oninput="this.value=maskPhone(this.value)">
        <div class="form-error hidden" id="err-telefone"></div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>WhatsApp</label>
        <input type="text" id="form-whatsapp" value="${esc(c?.whatsapp||'')}" maxlength="20" oninput="this.value=maskPhone(this.value)">
      </div>
      <div class="form-group">
        <label>Data de Nascimento</label>
        <input type="date" id="form-nascimento" value="${c?.dataNascimento||''}">
      </div>
    </div>
    <div class="form-group">
      <label>Renda Presumida (R$)</label>
      <input type="number" id="form-renda" step="0.01" min="0" value="${c?.rendaPresumida??''}" placeholder="0,00">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>CEP</label>
        <input type="text" id="form-cep" value="${esc(c?.cep||'')}" maxlength="9" oninput="this.value=maskCep(this.value)" onblur="autoPreencherCepModal()">
      </div>
      <div class="form-group">
        <label>UF</label>
        <select id="form-uf">
          <option value="">—</option>
          ${CONFIG.UF_LIST.map(uf => `<option value="${uf}" ${c?.uf===uf?'selected':''}>${uf}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Cidade</label>
        <input type="text" id="form-cidade" value="${esc(c?.cidade||'')}" maxlength="80">
      </div>
      <div class="form-group">
        <label>Bairro</label>
        <input type="text" id="form-bairro" value="${esc(c?.bairro||'')}" maxlength="80">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Logradouro</label>
        <input type="text" id="form-logradouro" value="${esc(c?.logradouro||'')}" maxlength="120">
      </div>
      <div class="form-group">
        <label>Número</label>
        <input type="text" id="form-numero" value="${esc(c?.numeroEndereco||'')}" maxlength="10">
      </div>
    </div>
    <div class="form-group">
      <label>Complemento</label>
      <input type="text" id="form-complemento" value="${esc(c?.complemento||'')}" maxlength="60">
    </div>`;
  const footer = `
    <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn-primary" onclick="saveClienteModal(${c?.id??'null'})">${isEdit?'💾 Salvar':'➕ Criar'}</button>`;
  openModal(isEdit?'Editar Cliente':'Novo Cliente', body, footer);
}

async function autoPreencherCepModal() {
  const cep = document.getElementById('form-cep')?.value;
  if (!cep) return;
  const data = await buscarCep(cep);
  if (!data) return;
  const setVal = (id,val) => { const el=document.getElementById(id); if(el&&!el.value) el.value=val; };
  setVal('form-logradouro', data.logradouro);
  setVal('form-bairro', data.bairro);
  setVal('form-cidade', data.localidade);
  setVal('form-uf', data.uf);
  setVal('form-complemento', data.complemento);
  toast('📍 Endereço auto-preenchido!', 'info', 2000);
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
  if (data.nome.length < 2) { showFieldError('nome','Mínimo 2 caracteres'); hasError=true; }
  if (!data.cpfCnpj) { showFieldError('cpf','CPF/CNPJ é obrigatório'); hasError=true; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { showFieldError('email','E-mail inválido'); hasError=true; }
  if (!data.telefone) { showFieldError('telefone','Telefone é obrigatório'); hasError=true; }
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

async function deleteCliente(id) {
  openModal('Confirmar Exclusão',
    '<p style="font-size:.9rem;line-height:1.5">Excluir este cliente? Ação irreversível.</p>',
    `<button class="btn-ghost" onclick="closeModal()">Cancelar</button>
     <button class="btn-danger" onclick="confirmDeleteCliente(${id})">🗑️ Excluir</button>`);
}
async function confirmDeleteCliente(id) {
  try { await API.deletarCliente(id); toast('✅ Cliente excluído.', 'success'); closeModal(); loadClientesLista(); }
  catch (err) { toast(`❌ ${err.message}`, 'error'); }
}

// ============================================================
//  EVENT LISTENERS
// ============================================================
function initEvents() {
  document.querySelectorAll('.nav-tab').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));
  document.querySelectorAll('.inner-tab').forEach(t => t.addEventListener('click', () => switchInnerTab(t.dataset.inner)));

  document.getElementById('btn-buscar-cliente').addEventListener('click', buscarClienteConsole);
  document.getElementById('search-cpf').addEventListener('keydown', e => { if (e.key==='Enter') buscarClienteConsole(); });

  document.getElementById('btn-nova-cobranca').addEventListener('click', () => showCobrancaForm());

  // Ocorrência
  document.getElementById('btn-registrar-ocorrencia').addEventListener('click', registrarOcorrencia);
  const ocTextarea = document.getElementById('oc-descricao');
  ocTextarea.addEventListener('input', () => {
    const len = ocTextarea.value.length;
    document.getElementById('oc-char-count').textContent = len;
    document.getElementById('btn-registrar-ocorrencia').disabled = len < 10;
  });

  // Toggle compromisso → habilita data + valor
  document.getElementById('oc-compromisso').addEventListener('change', (e) => {
    const isYes = e.target.value === 'true';
    document.getElementById('oc-data-compromisso').disabled = !isYes;
    document.getElementById('oc-valor-acordo').disabled = !isYes;
    if (!isYes) { document.getElementById('oc-data-compromisso').value=''; document.getElementById('oc-valor-acordo').value=''; }
  });

  // Cadastros
  document.getElementById('btn-novo-cliente').addEventListener('click', () => showClienteFormModal());
  document.getElementById('search-cliente-lista').addEventListener('input', e => filterClientesLista(e.target.value));

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id==='modal-overlay') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key==='Escape') closeModal(); });
}

window.addEventListener('DOMContentLoaded', () => {
  initEvents();
  API.listarClientes().then(d => { allClientes = d; }).catch(() => {});
});

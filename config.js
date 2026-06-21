const CONFIG = {
  API_BASE_URL: 'http://localhost:8080/api',

  ENDPOINTS: {
    CLIENTES: '/clientes',
    CLIENTE_BY_ID: (id) => `/clientes/${id}`,
    COBRANCAS: '/cobrancas',
    COBRANCA_BY_ID: (id) => `/cobrancas/${id}`,
    COBRANCA_FILTRO_STATUS: '/cobrancas/filtro/status',
    COBRANCA_FILTRO_CLIENTE: '/cobrancas/filtro/cliente',
    COBRANCA_FILTRO_VALOR: '/cobrancas/filtro/valor',
    COBRANCA_POR_CLIENTE: (id) => `/cobrancas/cliente/${id}`,
    DASHBOARD: '/cobrancas/dashboard',
    OCORRENCIA_CRIAR: (clienteId) => `/ocorrencias/cliente/${clienteId}`,
    OCORRENCIA_LISTAR: (clienteId) => `/ocorrencias/cliente/${clienteId}`,
    OCORRENCIAS_RECENTES: '/ocorrencias/recentes',
  },

  STATUS_CLIENTE: [
    { value: 'INADIMPLENTE', label: 'Inadimplente', color: '#ff5252', icon: '⛔' },
    { value: 'EM_ACORDO', label: 'Em Acordo', color: '#ffc107', icon: '🤝' },
    { value: 'REGULARIZADO', label: 'Regularizado', color: '#00e676', icon: '✅' },
  ],

  STATUS_COBRANCA: [
    { value: 'PENDENTE', label: 'Pendente', color: '#ff5252', icon: '📋' },
    { value: 'NOTIFICADO', label: 'Notificado', color: '#ff9800', icon: '📨' },
    { value: 'EM_NEGOCIACAO', label: 'Em Negociação', color: '#ffc107', icon: '💬' },
    { value: 'PROPOSTA_ENVIADA', label: 'Proposta Enviada', color: '#2196f3', icon: '📤' },
    { value: 'PAGO', label: 'Pago', color: '#00e676', icon: '💰' },
    { value: 'JUDICIAL', label: 'Judicial', color: '#9e9e9e', icon: '⚖️' },
  ],

  TIPO_OCORRENCIA: [
    { value: 'LIGACAO', label: 'Ligação', icon: '📞' },
    { value: 'WHATSAPP', label: 'WhatsApp', icon: '💬' },
    { value: 'SMS', label: 'SMS', icon: '📱' },
    { value: 'EMAIL', label: 'E-mail', icon: '✉️' },
    { value: 'VISITA', label: 'Visita', icon: '🚶' },
    { value: 'CARTA', label: 'Carta', icon: '✉️' },
    { value: 'SISTEMA', label: 'Sistema', icon: '🤖' },
  ],

  RESULTADO_OCORRENCIA: [
    { value: 'CONTATO_EFETUADO', label: 'Contato Efetuado', icon: '✅' },
    { value: 'NAO_ATENDEU', label: 'Não Atendeu', icon: '📵' },
    { value: 'CAIXA_POSTAL', label: 'Caixa Postal', icon: '📨' },
    { value: 'NUMERO_INVALIDO', label: 'Número Inválido', icon: '❌' },
    { value: 'CLIENTE_RECUSOU', label: 'Cliente Recusou', icon: '😡' },
    { value: 'PROMESSA_PAGAMENTO', label: 'Promessa de Pagamento', icon: '🤞' },
    { value: 'ACORDO_FECHADO', label: 'Acordo Fechado', icon: '🤝' },
    { value: 'CLIENTE_RECLAMOU', label: 'Cliente Reclamou', icon: '⚠️' },
    { value: 'SEM_CONTATO', label: 'Sem Contato', icon: '❓' },
  ],

  FORMA_PAGAMENTO: [
    { value: 'PIX', label: 'PIX', icon: '⚡' },
    { value: 'BOLETO', label: 'Boleto', icon: '🧾' },
    { value: 'CARTAO_CREDITO', label: 'Cartão de Crédito', icon: '💳' },
    { value: 'CARTAO_DEBITO', label: 'Cartão de Débito', icon: '💳' },
    { value: 'TRANSFERENCIA', label: 'Transferência', icon: '🏦' },
    { value: 'DINHEIRO', label: 'Dinheiro', icon: '💵' },
    { value: 'DEBITO_AUTOMATICO', label: 'Débito Automático', icon: '🔄' },
  ],

  CATEGORIAS_DEBITO: [
    'Cartão de Crédito',
    'Financiamento',
    'Empréstimo Pessoal',
    'Financiamento de Veículo',
    'Conta de Energia',
    'Conta de Água',
    'Telefone / Internet',
    'Aluguel',
    'Condomínio',
    'Plano de Saúde',
    'Mensalidade Escolar',
    'Serviços Profissionais',
    'Cheque Sem Fundo',
    'Outros',
  ],

  UF_LIST: ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'],

  THEME: {
    bg: '#0a0e1a', surface: 'rgba(20,27,45,0.85)', border: 'rgba(255,255,255,0.08)',
    accent: '#00d4ff', accent2: '#7c4dff', danger: '#ff5252', success: '#00e676',
    warning: '#ffc107', text: '#e8eaf6', textMuted: 'rgba(232,234,246,0.55)',
  },

  CURRENCY: 'BRL',
  LOCALE: 'pt-BR',
};

// ─── Helpers ───
function statusClienteInfo(v) { return CONFIG.STATUS_CLIENTE.find(s => s.value === v) ?? { label: v, color: '#9e9e9e', icon: '❓' }; }
function statusCobrancaInfo(v) { return CONFIG.STATUS_COBRANCA.find(s => s.value === v) ?? { label: v, color: '#9e9e9e', icon: '❓' }; }
function tipoOcorrenciaInfo(v) { return CONFIG.TIPO_OCORRENCIA.find(s => s.value === v) ?? { label: v, icon: '❓' }; }
function resultadoOcorrenciaInfo(v) { return CONFIG.RESULTADO_OCORRENCIA.find(s => s.value === v) ?? { label: v, icon: '❓' }; }
function formaPagamentoInfo(v) { return CONFIG.FORMA_PAGAMENTO.find(s => s.value === v) ?? { label: v, icon: '❓' }; }

function formatCurrency(value) {
  const num = Number(value ?? 0);
  return num.toLocaleString(CONFIG.LOCALE, { style: 'currency', currency: CONFIG.CURRENCY, minimumFractionDigits: 2 });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(CONFIG.LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString(CONFIG.LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Máscara de CPF/CNPJ ───
function maskCpfCnpj(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // CNPJ: 00.000.000/0000-00
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
      .substring(0, 18);
  }
}

// ─── Máscara de CEP ───
function maskCep(value) {
  const d = value.replace(/\D/g, '');
  return d.replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
}

// ─── Máscara de telefone ───
function maskPhone(value) {
  const d = value.replace(/\D/g, '');
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d)/, '($1) $2-$3').substring(0, 14);
  } else {
    return d.replace(/(\d{2})(\d{5})(\d)/, '($1) $2-$3').substring(0, 15);
  }
}

// ─── Busca endereço via ViaCEP ───
async function buscarCep(cep) {
  const limpo = cep.replace(/\D/g, '');
  if (limpo.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch { return null; }
}

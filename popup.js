document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnOpen');
  const spinner = document.getElementById('spinner');
  const btnIcon = document.getElementById('btnIcon');
  const btnLabel = document.getElementById('btnLabel');
  const statusEl = document.getElementById('status');

  const config = window.EMS_CONFIG || {};
  const msg = config.statusMessages || {};

  function setLoading(on) {
    btn.disabled = on;
    spinner.style.display = on ? 'block' : 'none';
    btnIcon.style.display = on ? 'none' : 'block';
    btnLabel.textContent = on ? (msg.loading || 'Carregando dados...') : (msg.ready || 'Abrir Painel Ops');
  }

  function showStatus(type, message) {
    statusEl.className = `status ${type}`;
    statusEl.textContent = message;
  }

  async function runInPage(tabId, month) {
    // Injeta os scripts necessários no contexto da página
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: ['config.js', 'ems-ops.js']
    });

    // Pequeno delay para garantir que o script foi processado pelo browser
    await new Promise(resolve => setTimeout(resolve, 100));

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (userMonth) => {
        // Verifica se a função existe no objeto window
        const fn = window.runEMSOps;
        if (typeof fn !== 'function') {
          return { error: 'Função runEMSOps não encontrada no contexto da página após injeção.' };
        }
        try {
          return fn(userMonth);
        } catch (e) {
          return { error: `Erro ao executar runEMSOps: ${e.message}` };
        }
      },
      args: [month]
    });

    return result;
  }

  btn.addEventListener('click', async () => {
    setLoading(true);
    statusEl.className = 'status';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes(config.serviceNowHostHint || 'service-now.com')) {
      setLoading(false);
      showStatus('error', msg.invalidTab || '⚠ Abra o ServiceNow primeiro.');
      return;
    }

    try {
      const currentMonth = new Date().getMonth() + 1;
      const result = await runInPage(tab.id, currentMonth);

      if (result?.error) {
        showStatus('error', `❌ ${result.error}`);
      } else {
        showStatus('success', msg.opened || '✅ Painel aberto!');
      }
    } catch (error) {
      showStatus('error', `❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  });
});

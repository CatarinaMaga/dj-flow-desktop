document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('yt-link-input');
    const btnDownload = document.getElementById('btn-download');
    const btnFolder = document.getElementById('btn-folder');
    const logList = document.getElementById('download-log');
    
    const trackPreview = document.getElementById('track-preview');
    const previewThumb = document.getElementById('preview-thumb');
    const previewTitle = document.getElementById('preview-title');
    const previewDuration = document.getElementById('preview-duration');

    let firstDownload = true;
    let currentTrackInfo = null;

    function addLog(msg, color = "#ccc") {
        if (firstDownload) { 
            logList.innerHTML = ''; 
            firstDownload = false; 
        }
        const li = document.createElement('li');
        li.style.color = color;
        const time = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        li.innerHTML = `<span style="opacity: 0.4">[${time}]</span> ${msg}`;
        logList.prepend(li);
    }

    // Debounce function to avoid multiple calls
    let timeout = null;
    input.addEventListener('input', () => {
        const url = input.value.trim();
        clearTimeout(timeout);
        
        if (!url || (!url.includes('youtu') && !url.includes('youtube.com'))) {
            trackPreview.style.display = 'none';
            btnDownload.disabled = true;
            return;
        }

        timeout = setTimeout(fetchTrackInfo, 600);
    });

    async function fetchTrackInfo() {
        const url = input.value.trim();
        if (!url) return;

        addLog(`🔍 Analisando link...`, 'var(--accent-cyan)');
        
        try {
            const res = await fetch(`http://localhost:3891/info/youtube?url=${encodeURIComponent(url)}`);
            
            // Verificação robusta: se o servidor retornar HTML (conflito de porta), capturamos aqui
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await res.text();
                console.error("Resposta não-JSON recebida:", text.substring(0, 100));
                throw new Error("O servidor local retornou um formato inesperado (HTML). Verifique se há outro programa usando a porta 3891.");
            }

            const data = await res.json();
            
            if (data.error) throw new Error(data.error);

            currentTrackInfo = data;
            
            // Show Preview
            previewTitle.textContent = data.title;
            previewDuration.textContent = data.duration;
            if (data.thumbnail) {
                previewThumb.style.backgroundImage = `url(${data.thumbnail})`;
            }
            
            trackPreview.style.display = 'flex';
            btnDownload.disabled = false;
            addLog(`⭐ Pronto para baixar: ${data.title.substring(0, 40)}...`, 'var(--accent-green)');

        } catch (e) {
            console.error(e);
            addLog(`❌ ERRO: ${e.message}`, 'var(--danger)');
            trackPreview.style.display = 'none';
            btnDownload.disabled = true;
        }
    }

    btnDownload.addEventListener('click', async () => {
        const url = input.value.trim();
        
        if (!url) return;

        input.value = ''; 
        btnDownload.disabled = true;
        const originalText = btnDownload.innerHTML;
        btnDownload.innerHTML = `<span class="icon">⏳</span> Materializando no Cofre...`;
        
        addLog(`🚀 Iniciando download materializado...`, 'var(--accent-purple)');

        try {
            const res = await fetch(`http://localhost:3891/download/disk?url=${encodeURIComponent(url)}`);
            
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Erro de comunicação com o motor (Porta 3891 ocupada).");
            }

            const data = await res.json();
            
            if (data.error) throw new Error(data.error);

            addLog(`✅ SUCESSO! "${currentTrackInfo?.title || 'Arquivo'}" salvo no Cofre.`, 'var(--accent-green)');
            
            // Reset preview
            trackPreview.style.display = 'none';
            currentTrackInfo = null;

        } catch (e) {
            addLog(`❌ ERRO NO MOTOR: ${e.message}`, 'var(--danger)');
        } finally {
            btnDownload.disabled = true; // Wait for next link
            btnDownload.innerHTML = originalText;
        }
    });

    btnFolder.addEventListener('click', async () => {
        try {
            await fetch(`http://localhost:3891/open-folder`);
        } catch(e) {
            console.error("Erro ao abrir pasta", e);
            addLog(`❌ Não foi possível abrir a pasta.`, 'var(--danger)');
        }
    });
});

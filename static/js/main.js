document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.alert:not(.alert-danger)').forEach(alert => {
        setTimeout(() => {
            const inst = bootstrap.Alert.getOrCreateInstance(alert);
            inst.close();
        }, 4500);
    });

    document.querySelectorAll('textarea[data-autosize]').forEach(ta => {
        const resize = () => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        };
        ta.addEventListener('input', resize);
        resize();
    });

    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'btn btn-primary scroll-top';
    scrollBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
    scrollBtn.style.cssText = 'position:fixed;right:24px;bottom:24px;border-radius:50%;width:46px;height:46px;display:none;z-index:1030;box-shadow:0 4px 12px rgba(0,0,0,.15);';
    document.body.appendChild(scrollBtn);
    window.addEventListener('scroll', () => {
        scrollBtn.style.display = window.scrollY > 400 ? 'inline-flex' : 'none';
    });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
});

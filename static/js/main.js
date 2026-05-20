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
});

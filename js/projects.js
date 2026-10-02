function initProjectsPagination(doc = document) {
    const list = doc.querySelector('.project-list');
    if (!list) return;

    const cards = Array.from(list.querySelectorAll('.project-card'));
    if (!cards.length) return;

    let pagination = doc.querySelector('.pagination-controls');
    if (pagination) pagination.remove();

    const perPage = 6;
    const totalPages = Math.max(1, Math.ceil(cards.length / perPage));

    if (totalPages === 1) {
        cards.forEach(card => {
            card.style.display = '';
            card.style.opacity = '';
            card.style.animation = '';
        });
        return;
    }

    pagination = doc.createElement('div');
    pagination.className = 'pagination-controls';
    list.parentNode.insertBefore(pagination, list.nextSibling);

    let currentPage = 1;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    function renderPage(page, scroll = false) {
        currentPage = page;
        cards.forEach((card, index) => {
            if (index >= (page - 1) * perPage && index < page * perPage) {
                card.style.display = '';
                if (!reduceMotion) {
                    card.style.opacity = '0';
                    card.style.animation = 'fadeInCard 0.4s ease forwards';
                } else {
                    card.style.opacity = '';
                    card.style.animation = '';
                }
            } else {
                card.style.display = 'none';
            }
        });

        pagination.innerHTML = '';

        const prevBtn = doc.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'pagination-btn';
        prevBtn.textContent = '< Prev';
        prevBtn.disabled = page === 1;
        prevBtn.onclick = () => renderPage(page - 1, true);
        pagination.appendChild(prevBtn);

        for (let i = 1; i <= totalPages; i++) {
            const btn = doc.createElement('button');
            btn.type = 'button';
            btn.className = 'pagination-btn' + (i === page ? ' active' : '');
            btn.textContent = i;
            btn.onclick = () => renderPage(i, true);
            pagination.appendChild(btn);
        }

        const nextBtn = doc.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'pagination-btn';
        nextBtn.textContent = 'Next >';
        nextBtn.disabled = page === totalPages;
        nextBtn.onclick = () => renderPage(page + 1, true);
        pagination.appendChild(nextBtn);

        if (scroll) {
            const yOffset = list.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: yOffset, behavior: 'smooth' });
        }
    }
    
    renderPage(1, false);
}

function initProjectsPagination(doc = document) {
    const list = doc.querySelector('.project-list');
    if (!list) return;
    const cards = Array.from(list.querySelectorAll('.project-card'));
    if (!cards.length) return;
    
    let pagination = doc.querySelector('.pagination-controls');
    if (pagination) pagination.remove();
    
    const perPage = 6;
    const totalPages = Math.max(1, Math.ceil(cards.length / perPage));
    
    pagination = doc.createElement('div');
    pagination.className = 'pagination-controls';
    list.parentNode.insertBefore(pagination, list.nextSibling);
    
    let currentPage = 1;
    
    function renderPage(page, scroll = false) {
        currentPage = page;
        cards.forEach((card, index) => {
            if (index >= (page - 1) * perPage && index < page * perPage) {
                card.style.display = '';
                card.style.opacity = '0';
                card.style.animation = 'fadeInCard 0.4s ease forwards';
            } else {
                card.style.display = 'none';
            }
        });
        
        pagination.innerHTML = '';
        
        const prevBtn = doc.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.textContent = '< Prev';
        prevBtn.disabled = page === 1;
        prevBtn.onclick = () => renderPage(page - 1, true);
        pagination.appendChild(prevBtn);
        
        for (let i = 1; i <= totalPages; i++) {
            const btn = doc.createElement('button');
            // active class only applies if page > 1 or we still just show it as disabled
            btn.className = 'pagination-btn' + (i === page ? ' active' : '');
            btn.textContent = i;
            if (totalPages === 1) btn.disabled = true; // gray out the 1 if there's only 1 page
            btn.onclick = () => renderPage(i, true);
            pagination.appendChild(btn);
        }
        
        const nextBtn = doc.createElement('button');
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

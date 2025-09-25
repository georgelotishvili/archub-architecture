// ===== ARCHUB - მთავარი JavaScript ფაილი =====
// ეს ფაილი შეიცავს მთავარი გვერდის ფუნქციონალს
// ავტორიზაცია, პროექტების ჩატვირთვა, კონტაქტ ფორმა

document.addEventListener('DOMContentLoaded', function() {
    // ===== კარუსელის ფოტოების ჩატვირთვა =====
    loadCarouselImages();
    
    // ===== ელემენტების არჩევა =====
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authBtn = document.getElementById('authBtn');
    const mobileAuthBtn = document.getElementById('mobileAuthBtn');
    const myPageBtn = document.getElementById('myPageBtn');
    const mobileMyPageBtn = document.getElementById('mobileMyPageBtn');
    const showRegisterModalLink = document.getElementById('showRegisterModal');
    const showLoginModalLink = document.getElementById('showLoginModal');
    
    // ===== გლობალური ცვლადები =====
    // ავტორიზაციის სტატუსის თვალყურის დევნება
    let userAuthenticated = false;
    let currentUser = null;
    
    // --- ავტორიზაციის სტატუსის შემოწმება ---
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            if (data.logged_in) {
                userAuthenticated = true;
                currentUser = data.user;
                updateAuthButtons('logout');
            } else {
                userAuthenticated = false;
                currentUser = null;
                updateAuthButtons('login');
            }
            
            // ავტორიზაციის სტატუსის გლობალურად ხელმისაწვდომად გაკეთება
            window.userAuthenticated = userAuthenticated;
            
            // ლაიქების ღილაკების ხელახალი რენდერი ავტორიზაციის სტატუსის შემოწმების შემდეგ
            if (typeof renderProjectsCards === 'function') {
                renderProjectsCards();
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            userAuthenticated = false;
            currentUser = null;
            updateAuthButtons('login');
            window.userAuthenticated = false;
        }
    }
    
    // --- ავტორიზაციის ღილაკების განახლება ---
    function updateAuthButtons(state) {
        if (state === 'logout') {
            if (authBtn) {
                authBtn.textContent = 'გასვლა';
                authBtn.onclick = handleLogout;
            }
            if (mobileAuthBtn) {
                mobileAuthBtn.textContent = 'გასვლა';
                mobileAuthBtn.onclick = handleLogout;
            }
            // ჩემი გვერდის ღილაკების ჩვენება შესვლისას
            if (myPageBtn) {
                myPageBtn.style.display = 'block';
                myPageBtn.onclick = () => window.location.href = '/my-page';
            }
            if (mobileMyPageBtn) {
                mobileMyPageBtn.style.display = 'block';
                mobileMyPageBtn.onclick = () => window.location.href = '/my-page';
            }
        } else {
            if (authBtn) {
                authBtn.textContent = 'შესვლა';
                authBtn.onclick = () => openModal('loginModal');
            }
            if (mobileAuthBtn) {
                mobileAuthBtn.textContent = 'შესვლა';
                mobileAuthBtn.onclick = () => openModal('loginModal');
            }
            // ჩემი გვერდის ღილაკების დამალვა გამოსვლისას
            if (myPageBtn) {
                myPageBtn.style.display = 'none';
            }
            if (mobileMyPageBtn) {
                mobileMyPageBtn.style.display = 'none';
            }
        }
    }
    
    // --- გასვლის დამუშავება ---
    async function handleLogout() {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                userAuthenticated = false;
                currentUser = null;
                window.userAuthenticated = false;
                updateAuthButtons('login');
                // ლაიქების ღილაკების ხელახალი რენდერი გამოსვლის შემდეგ
                renderProjectsCards();
                alert('წარმატებით გამოხვედით სისტემიდან!');
                // Reload the page to update the UI state
                window.location.reload();
            } else {
                alert('შეცდომა გასვლისას: ' + (data.error || 'უცნობი შეცდომა'));
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('შეცდომა სერვერთან კავშირისას.');
        }
    }
    
    // --- მოდალური ფანჯრების მართვა ---
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    }

    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    // ყველა დახურვის ღილაკზე მოსმენის დამატება
    document.querySelectorAll('.auth-modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.auth-modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // --- ავტორიზაციის ღილაკების მოვლენები ---
    // ეს განისაზღვრება updateAuthButtons ფუნქციით ავტორიზაციის სტატუსის მიხედვით

    // --- მოდალური ფანჯრების გადართვა ---
    if (showRegisterModalLink) {
        showRegisterModalLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal('loginModal');
            openModal('registerModal');
        });
    }

    if (showLoginModalLink) {
        showLoginModalLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal('registerModal');
            openModal('loginModal');
        });
    }
    
    // --- შესვლის ფორმის გაგზავნა ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'შესვლა...';

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const result = await response.json();

                if (result.success) {
                    userAuthenticated = true;
                    currentUser = result.user;
                    window.userAuthenticated = true;
                    updateAuthButtons('logout');
                    // ლაიქების ღილაკების ხელახალი რენდერი ავტორიზაციის შემდეგ
                    renderProjectsCards();
                    alert('წარმატებით შეხვედით სისტემაში!');
                    closeModal('loginModal');
                } else {
                    alert('შეცდომა: ' + result.error);
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('სერვერთან დაკავშირების შეცდომა.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'შესვლა';
            }
        });
    }

    // --- რეგისტრაციის ფორმის გაგზავნა ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'რეგისტრაცია...';

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
                const result = await response.json();

                if (result.success) {
                    alert(result.message);
                    closeModal('registerModal');
                    openModal('loginModal');
                } else {
                    alert('შეცდომა: ' + result.error);
                }
            } catch (error) {
                console.error('Registration error:', error);
                alert('სერვერთან დაკავშირების შეცდომა.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'რეგისტრაცია';
            }
        });
    }


    // --- მობილური მენიუ ---
    const burger = document.querySelector('.burger-menu');
    const panel = document.getElementById('mobileNavPanel');
    const icon = document.querySelector('.burger-icon');
    const body = document.body;

    function toggleMobileMenu() {
        panel.classList.toggle('active');
        icon.classList.toggle('active');
        body.classList.toggle('nav-open');
    }

    function closeMobileMenu() {
        panel.classList.remove('active');
        icon.classList.remove('active');
        body.classList.remove('nav-open');
    }

    if (burger) {
        burger.addEventListener('click', toggleMobileMenu);
    }
    
    document.querySelectorAll('.mobile-nav-link, .mobile-auth-btn, #mobileNavClose').forEach(btn => {
        btn.addEventListener('click', closeMobileMenu);
    });

    // --- პროექტების ღილაკი ---
    const projectsBtn = document.querySelector('.projects-btn');
    if (projectsBtn) {
        projectsBtn.addEventListener('click', () => {
            window.open('https://gipc.ge', '_blank');
        });
    }

    // Close mobile menu on window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) closeMobileMenu();
    });

    // --- გუნდის კარუსელი ---
let teamCurrentSlide = 0;
let teamIsTransitioning = false;

function initTeamCarousel() {
    const teamCarousel = document.querySelector('.team-carousel-container');
    const teamSlides = document.querySelectorAll('.team-slide');
    const prevBtn = document.getElementById('teamCarouselPrev');
    const nextBtn = document.getElementById('teamCarouselNext');
    
    if (!teamCarousel || !teamSlides.length) return;
    
        // სლაიდების ინიციალიზაცია
    teamSlides.forEach(slide => {
        slide.style.opacity = '0';
        slide.style.transform = 'translateX(100%)';
        slide.style.transition = 'none';
    });
    
    if (teamSlides[0]) {
        teamSlides[0].style.opacity = '1';
        teamSlides[0].style.transform = 'translateX(0)';
    }
    
    // მოვლენების მოსმენები
        if (nextBtn) nextBtn.addEventListener('click', () => moveTeamSlide(1));
        if (prevBtn) prevBtn.addEventListener('click', () => moveTeamSlide(-1));
    
        // კლავიატურის ნავიგაცია
    document.addEventListener('keydown', (e) => {
        if (teamCarousel && isTeamCarouselVisible(teamCarousel)) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                moveTeamSlide(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                moveTeamSlide(1);
            }
        }
    });
}

function isTeamCarouselVisible(carousel) {
    const rect = carousel.closest('.section-3').getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
}

function moveTeamSlide(direction) {
    if (teamIsTransitioning) return;
    
    const teamSlides = document.querySelectorAll('.team-slide');
    const totalSlides = teamSlides.length;
    
    teamIsTransitioning = true;
    
        // მიმდინარე სლაიდის დამალვა
    const currentSlide = teamSlides[teamCurrentSlide];
    if (currentSlide) {
        currentSlide.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        currentSlide.style.opacity = '0';
        currentSlide.style.transform = direction === 1 ? 'translateX(-100%)' : 'translateX(100%)';
    }
    
        // შემდეგი/წინა სლაიდის ჩვენება
    teamCurrentSlide = (teamCurrentSlide + direction + totalSlides) % totalSlides;
    const nextSlide = teamSlides[teamCurrentSlide];
    
    if (nextSlide) {
        nextSlide.style.transition = 'none';
        nextSlide.style.opacity = '0';
        nextSlide.style.transform = direction === 1 ? 'translateX(100%)' : 'translateX(-100%)';
        
        setTimeout(() => {
            nextSlide.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            nextSlide.style.opacity = '1';
            nextSlide.style.transform = 'translateX(0)';
            
            setTimeout(() => {
                teamIsTransitioning = false;
            }, 300);
        }, 50);
    }
}

    // --- პროექტების კარუსელი ---
let projectsCards = [];
let currentCardIndex = 0;
let projectsIsTransitioning = false;
let cardsContainer = null;
    let totalCards = 0;

async function initProjectsCarousel() {
    const cardsWrapper = document.getElementById('cardsWrapper');
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    
    if (!cardsWrapper || !prevBtn || !nextBtn) return;
    
        // ქარდების კონტეინერის შექმნა
    cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    cardsWrapper.appendChild(cardsContainer);
    
        // ინიციალიზაცია
    await loadCardsFromAPI();
    renderProjectsCards();
    
    // საწყისი პოზიციის დაყენება შუა სექციიდან (ორიგინალური ქარდები)
    currentCardIndex = totalCards;
    
    // მოვლენების მოსმენები
    prevBtn.addEventListener('click', () => {
        console.log('Previous button clicked');
        moveCarousel(-1);
    });
    nextBtn.addEventListener('click', () => {
        console.log('Next button clicked');
        moveCarousel(1);
    });
    
    // ფანჯრის ზომის შეცვლისას პოზიციის გადათვლა
    window.addEventListener('resize', () => {
        updateCarouselPosition();
    });
    
    // პირველი ქარდის ცენტრირებისთვის საწყისი პოზიციის განახლება
    setTimeout(() => {
        updateCarouselPosition();
    }, 100);
}

    // ქარდების ჩატვირთვა API-დან
async function loadCardsFromAPI() {
    try {
        const response = await fetch('/api/projects');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.projects) {
            projectsCards = data.projects.map(project => {
                // Create photos array with main image first, then gallery photos
                const allPhotos = [];
                if (project.main_image_url) {
                    allPhotos.push({
                        url: project.main_image_url,
                        title: 'მთავარი ფოტო'
                    });
                }
                if (project.photos && project.photos.length > 0) {
                    project.photos.forEach(photoUrl => {
                        allPhotos.push({
                            url: photoUrl,
                            title: 'პროექტის ფოტო'
                        });
                    });
                }
                
                return {
                    id: project.id,
                    title: project.title || '',
                    description: project.description || '',
                    area: project.area,
                    image: project.main_image_url,
                    link: `card-detail.html?id=${project.id}`,
                    is_liked: project.is_liked,
                    likes_count: project.likes_count,
                    photos: allPhotos
                };
            });
            
            // ძებნისთვის ყველა პროექტის შენახვა
            allProjects = [...projectsCards];
            
            totalCards = projectsCards.length;
        } else {
            createRandomCards();
        }
    } catch (error) {
        console.error('Error loading cards from API:', error);
        createRandomCards();
    }
}

function createRandomCards() {
    const sampleCards = [
        { area: '120 კვ.მ', image: 'photos/pro 1.png' },
        { area: '150 კვ.მ', image: 'photos/pro 2.jpg' },
        { area: '90 კვ.მ', image: 'photos/pro 3.png' },
        { area: '200 კვ.მ', image: 'photos/pro 4.jpg' },
        { area: '180 კვ.მ', image: 'photos/pro 5.jpg' }
    ];
    
    projectsCards = sampleCards.map((card, index) => ({
        id: `card-${index}`,
        title: `პროექტი ${index + 1}`,
        description: `ეს არის ${index + 1}-ე პროექტის აღწერა`,
        area: card.area,
        image: card.image,
        link: `card-detail.html?id=card-${index}`,
        photos: [{
            url: card.image,
            title: 'მთავარი ფოტო'
        }]
    }));
    
    // ძებნისთვის ყველა პროექტის შენახვა
    allProjects = [...projectsCards];
    
    totalCards = projectsCards.length;
}

function renderProjectsCards() {
        if (!cardsContainer || !projectsCards.length) return;
    
    console.log(`Rendering ${projectsCards.length} cards, totalCards=${totalCards}`);
    cardsContainer.innerHTML = '';
    
        // Create cards with duplication for infinite loop effect
        // Add cards at the beginning (for seamless transition from last to first)
        projectsCards.forEach((card, index) => {
            const cardElement = createCardElement(card, index, 'prepend');
            cardsContainer.appendChild(cardElement);
        });
        
        // Add original cards in the middle
        projectsCards.forEach((card, index) => {
            const cardElement = createCardElement(card, index, 'middle');
            cardsContainer.appendChild(cardElement);
        });
        
        // Add cards at the end (for seamless transition from first to last)
        projectsCards.forEach((card, index) => {
            const cardElement = createCardElement(card, index, 'append');
            cardsContainer.appendChild(cardElement);
        });
        
        // ყველა ქარდის რენდერის შემდეგ პოზიციის განახლება
        setTimeout(() => {
            updateCarouselPosition();
        }, 50);
}

function createCardElement(card, index, position) {
    const cardElement = document.createElement('div');
    cardElement.className = 'project-card';
    cardElement.setAttribute('data-original-index', index);
    cardElement.setAttribute('data-project-id', card.id);
    cardElement.setAttribute('data-position', position);
    
    // Create like button HTML (only for authenticated users)
    const likeButtonHtml = (card.is_liked !== undefined && window.userAuthenticated) ? `
        <button class="like-btn ${card.is_liked ? 'liked' : ''}" data-project-id="${card.id}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${card.is_liked ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
        </button>
    ` : '';
    
    cardElement.innerHTML = `
        <img src="${card.image}" class="card-image">
        <div class="card-info">
            <div class="card-area">${card.area}</div>
            ${card.title ? `<div class="card-title" style="display: none;">${card.title}</div>` : ''}
            ${card.description ? `<div class="card-description" style="display: none;">${card.description}</div>` : ''}
        </div>
        ${likeButtonHtml}
    `;
    
    cardElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Store the original index of the card
        card.originalIndex = index;
        
        // Navigate to gallery page with card data
        openGalleryForCard(card);
    });
    
    // Add like button click event listener
    const likeBtn = cardElement.querySelector('.like-btn');
    if (likeBtn) {
        likeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLikeClick(card.id, likeBtn);
        });
    }
    
    return cardElement;
}

function moveCarousel(direction) {
    if (projectsIsTransitioning || !projectsCards.length) return;
    
    projectsIsTransitioning = true;
    
    if (searchMode && filteredProjects.length > 0) {
        // ძებნის რეჟიმში - მხოლოდ ნაპოვნ პროექტებზე გადავიდეს
        moveToNextFoundProject(direction);
    } else {
        // ჩვეულებრივი რეჟიმი
        currentCardIndex += direction;
        updateCarouselPosition();
        
        // Check if we need to reset position for infinite loop
        setTimeout(() => {
            resetCarouselPositionIfNeeded();
            projectsIsTransitioning = false;
        }, 300);
    }
}

// ძებნის რეჟიმში შემდეგ/წინა ნაპოვნ პროექტზე გადასვლა
function moveToNextFoundProject(direction) {
    if (filteredProjects.length === 0) return;
    
    // მიმდინარე ნაპოვნი პროექტის ინდექსის განახლება
    searchCurrentIndex += direction;
    
    // ციკლური ნავიგაცია
    if (searchCurrentIndex >= filteredProjects.length) {
        searchCurrentIndex = 0;
    } else if (searchCurrentIndex < 0) {
        searchCurrentIndex = filteredProjects.length - 1;
    }
    
    // შემდეგი ნაპოვნი პროექტის ქარდის პოვნა
    const targetProject = filteredProjects[searchCurrentIndex];
    const cardsContainer = document.querySelector('.cards-container');
    const projectCards = cardsContainer.querySelectorAll('.project-card');
    
    const targetCard = Array.from(projectCards).find(card => 
        card.dataset.projectId == targetProject.id
    );
    
    if (targetCard) {
        scrollToCard(targetCard);
    }
    
    setTimeout(() => {
        projectsIsTransitioning = false;
    }, 500);
}

function resetCarouselPositionIfNeeded() {
    if (!cardsContainer) return;
    
    const allCards = cardsContainer.querySelectorAll('.project-card');
    const totalRenderedCards = allCards.length;
    const originalCardsCount = totalCards;
    
    // If we're at the end of the duplicated cards (going forward), reset to middle section
    if (currentCardIndex >= originalCardsCount * 2) {
        currentCardIndex = originalCardsCount;
        updateCarouselPosition(false); // No transition for reset
    }
    // If we're at the beginning of the duplicated cards (going backward), reset to middle section
    else if (currentCardIndex < 0) {
        currentCardIndex = originalCardsCount - 1;
        updateCarouselPosition(false); // No transition for reset
    }
}

function updateCarouselPosition(useTransition = true) {
    if (!cardsContainer) return;
    
    // Get carousel container width - use the full viewport width for centering
    const containerWidth = window.innerWidth;
    
    // Get responsive card dimensions based on screen width
    let cardWidth, cardGap;
    
    if (window.innerWidth <= 600) {
        // Mobile: 280px + 40px gap
        cardWidth = 280;
        cardGap = 40;
    } else if (window.innerWidth <= 900) {
        // Tablet: 380px + 40px gap
        cardWidth = 380;
        cardGap = 40;
    } else {
        // Desktop: 620px + 40px gap
        cardWidth = 620;
        cardGap = 40;
    }
    
    // Card width + gap
    const cardTotalWidth = cardWidth + cardGap;
    
    // Calculate center offset: (container width - card width) / 2
    // This ensures the current card is always centered horizontally
    const centerOffset = (containerWidth - cardWidth) / 2;
    
    // Move the entire container so that the current card is centered
    const translateX = -currentCardIndex * cardTotalWidth + centerOffset;
    
    if (useTransition) {
        cardsContainer.style.transition = 'transform 0.3s ease-in-out';
    } else {
        cardsContainer.style.transition = 'none';
    }
    cardsContainer.style.transform = `translateX(${translateX}px)`;
    
    // Debug info (can be removed later)
    console.log(`Carousel Debug:
        Container Width: ${containerWidth}px
        Card Width: ${cardWidth}px
        Card Gap: ${cardGap}px
        Card Total Width: ${cardTotalWidth}px
        Current Index: ${currentCardIndex}
        Center Offset: ${centerOffset}px
        Translate X: ${translateX}px`);
}

function updateCarouselButtons() {
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    
    if (prevBtn && nextBtn) {
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    }
}

    // --- გალერიის ფუნქციონალი ---
function openGalleryForCard(card) {
    // Store card data for gallery modal
    window.selectedCard = card;
    
    // Open gallery modal
    openGalleryModal(card);
}

    // --- გალერიის მოდალური ფანჯრის ფუნქციონალი ---
let galleryCurrentSlide = 0;
let gallerySlides = [];
let galleryDots = [];
let galleryTotalSlides = 0;

function initGalleryModal() {
    const galleryModal = document.getElementById('galleryModal');
    const galleryCloseBtn = document.getElementById('galleryCloseBtn');
    const galleryPrevBtn = document.getElementById('galleryPrevBtn');
    const galleryNextBtn = document.getElementById('galleryNextBtn');
    
    if (!galleryModal) return;
    
    // Event listeners
        if (galleryCloseBtn) galleryCloseBtn.addEventListener('click', closeGalleryModal);
        if (galleryPrevBtn) galleryPrevBtn.addEventListener('click', () => changeGallerySlide(-1));
        if (galleryNextBtn) galleryNextBtn.addEventListener('click', () => changeGallerySlide(1));
    
    // Close modal when clicking outside
    galleryModal.addEventListener('click', (e) => {
        if (e.target === galleryModal) closeGalleryModal();
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (galleryModal.classList.contains('active')) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                changeGallerySlide(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                changeGallerySlide(1);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeGalleryModal();
            }
        }
    });
}

// Open gallery modal
function openGalleryModal(card) {
    const galleryModal = document.getElementById('galleryModal');
    const gallery = document.getElementById('gallery');
    const noPhotos = document.getElementById('galleryNoPhotos');
    
    if (!galleryModal) return;
    
    // Show modal
    galleryModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Load gallery photos from selected card
    loadGalleryPhotosForModal();
}

// Load gallery photos for modal
function loadGalleryPhotosForModal() {
    const gallery = document.getElementById('gallery');
    const noPhotos = document.getElementById('galleryNoPhotos');
    
    try {
            // Use photos from the selected card
        if (window.selectedCard && window.selectedCard.photos && window.selectedCard.photos.length > 0) {
            displayGalleryPhotos(window.selectedCard.photos);
            gallery.style.display = 'block';
            noPhotos.style.display = 'none';
            return;
        }
        
        // If no selected card photos, show no photos message
        gallery.style.display = 'none';
        noPhotos.style.display = 'block';
    } catch (error) {
        console.error('Error loading gallery photos:', error);
        gallery.style.display = 'none';
        noPhotos.style.display = 'block';
    }
}

// Close gallery modal
function closeGalleryModal() {
    const galleryModal = document.getElementById('galleryModal');
    if (!galleryModal) return;
    
    galleryModal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Clear selected card
    window.selectedCard = null;
}

// Display photos in gallery
function displayGalleryPhotos(photos) {
    const carouselContainer = document.getElementById('galleryCarouselContainer');
    const dotsContainer = document.getElementById('galleryDots');
    
    if (!carouselContainer || !dotsContainer) return;
    
    // Clear existing content
    carouselContainer.innerHTML = '';
    dotsContainer.innerHTML = '';
    
    // Create slides
    photos.forEach((photo, index) => {
        const slide = document.createElement('div');
        slide.className = `slide ${index === 0 ? 'active' : ''}`;
        
        const photoUrl = typeof photo === 'string' ? photo : photo.url;
        
        // Create like button HTML for gallery (only for authenticated users)
        const likeButtonHtml = (window.selectedCard && window.selectedCard.is_liked !== undefined && window.userAuthenticated) ? `
            <button class="gallery-like-btn ${window.selectedCard.is_liked ? 'liked' : ''}" data-project-id="${window.selectedCard.id}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="${window.selectedCard.is_liked ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
            </button>
        ` : '';
        
        slide.innerHTML = `
            <img src="${photoUrl}" alt="Photo ${index + 1}">
            ${likeButtonHtml}
        `;
        carouselContainer.appendChild(slide);
        
        // Create dot
        const dot = document.createElement('button');
        dot.className = `dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => goToGallerySlide(index));
        dotsContainer.appendChild(dot);
    });
    
    // Add like button click event listener for gallery (for all slides)
    const galleryLikeBtns = document.querySelectorAll('.gallery-like-btn');
    galleryLikeBtns.forEach(galleryLikeBtn => {
        if (galleryLikeBtn && window.selectedCard) {
            galleryLikeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLikeClick(window.selectedCard.id, galleryLikeBtn);
            });
        }
    });
    
    // ცვლადების განახლება
    gallerySlides = document.querySelectorAll('#galleryCarouselContainer .slide');
    galleryDots = document.querySelectorAll('#galleryDots .dot');
    galleryTotalSlides = photos.length;
    galleryCurrentSlide = 0;
}

// Show specific slide
function showGallerySlide(index) {
    if (!gallerySlides || gallerySlides.length === 0) return;
    
    gallerySlides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
    });
    
    if (galleryDots && galleryDots.length > 0) {
        galleryDots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }
    
    galleryCurrentSlide = index;
}

// Change slide (previous/next)
function changeGallerySlide(direction) {
    if (galleryTotalSlides === 0) return;
    
    galleryCurrentSlide += direction;
    if (galleryCurrentSlide >= galleryTotalSlides) {
        galleryCurrentSlide = 0;
    } else if (galleryCurrentSlide < 0) {
        galleryCurrentSlide = galleryTotalSlides - 1;
    }
    showGallerySlide(galleryCurrentSlide);
}

// Go to specific slide
function goToGallerySlide(index) {
    if (index >= 0 && index < galleryTotalSlides) {
        showGallerySlide(index);
    }
}

    // --- მოწონების ფუნქციონალი ---
async function handleLikeClick(projectId, likeButton) {
    try {
        const response = await fetch(`/api/projects/${projectId}/like`, {
            method: 'POST',
                headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // ღილაკის ვიზუალური მდგომარეობის განახლება
            updateLikeButton(likeButton, data.liked, data.likes_count);
            
            // პროექტის ქარდის მონაცემების განახლება
            updateProjectCardData(projectId, data.liked, data.likes_count);
        } else {
            // Error handling
            const errorMessage = data.error || 'შეცდომა მოწონებისას';
            if (response.status === 401) {
                alert('შესვლა გჭირდებათ პროექტის მოსაწონებლად.');
            } else {
                alert(`შეცდომა: ${errorMessage}`);
            }
        }
        
    } catch (error) {
        console.error('Error during like/unlike:', error);
        alert('შეცდომა სერვერთან კავშირისას.');
    }
}

// მოწონების ღილაკის ვიზუალური მდგომარეობის განახლება
function updateLikeButton(likeButton, isLiked, likesCount) {
    const svg = likeButton.querySelector('svg');
    
    console.log('updateLikeButton called:', {
        buttonClass: likeButton.className,
        projectId: likeButton.getAttribute('data-project-id'),
        isLiked: isLiked,
        svgExists: !!svg
    });
    
    if (svg) {
        if (isLiked) {
            likeButton.classList.add('liked');
            svg.setAttribute('fill', '#ffffff');
            svg.setAttribute('stroke', '#ffffff');
            console.log('Set to LIKED - filled white heart');
        } else {
            likeButton.classList.remove('liked');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', '#ffffff');
            console.log('Set to UNLIKED - outline heart');
        }
    }
    
    // ასევე განაახლოს გალერიის ლაიქების ღილაკი (თუ არსებობს)
    const galleryLikeBtns = document.querySelectorAll('.gallery-like-btn');
    if (galleryLikeBtns.length > 0 && likeButton.classList.contains('like-btn')) {
        console.log('Syncing to gallery buttons');
        galleryLikeBtns.forEach(galleryLikeBtn => {
            const gallerySvg = galleryLikeBtn.querySelector('svg');
            if (gallerySvg) {
                if (isLiked) {
                    galleryLikeBtn.classList.add('liked');
                    gallerySvg.setAttribute('fill', '#ffffff');
                    gallerySvg.setAttribute('stroke', '#ffffff');
                } else {
                    galleryLikeBtn.classList.remove('liked');
                    gallerySvg.setAttribute('fill', 'none');
                    gallerySvg.setAttribute('stroke', '#ffffff');
                }
            }
        });
        console.log('Gallery buttons updated');
    }
    
    // ასევე განაახლოს ქარდის ლაიქების ღილაკი (თუ გალერიაში ლაიქს აჭერენ)
    if (likeButton.classList.contains('gallery-like-btn')) {
        console.log('Syncing to card button');
        const projectId = likeButton.getAttribute('data-project-id');
        const cardLikeBtns = document.querySelectorAll(`.like-btn[data-project-id="${projectId}"]`);
        cardLikeBtns.forEach(cardLikeBtn => {
            const cardSvg = cardLikeBtn.querySelector('svg');
            if (cardSvg) {
                if (isLiked) {
                    cardLikeBtn.classList.add('liked');
                    cardSvg.setAttribute('fill', '#ffffff');
                    cardSvg.setAttribute('stroke', '#ffffff');
                } else {
                    cardLikeBtn.classList.remove('liked');
                    cardSvg.setAttribute('fill', 'none');
                    cardSvg.setAttribute('stroke', '#ffffff');
                }
            }
        });
        console.log('Card buttons updated');
    }
}

// პროექტის ქარდის მონაცემების განახლება projectsCards მასივში
function updateProjectCardData(projectId, isLiked, likesCount) {
    projectsCards.forEach(card => {
        if (card.id == projectId) {
            card.is_liked = isLiked;
            card.likes_count = likesCount;
        }
    });
    
    // ასევე განაახლოს window.selectedCard (თუ ეს იგივე პროექტია)
    if (window.selectedCard && window.selectedCard.id == projectId) {
        window.selectedCard.is_liked = isLiked;
        window.selectedCard.likes_count = likesCount;
    }
}

    // --- ყველაფრის ინიციალიზაცია ---
    // Check authentication status on page load first
    checkAuthStatus();
    
    initTeamCarousel();
    initProjectsCarousel().catch(error => {
        console.error('Error initializing projects carousel:', error);
    });
    initGalleryModal();
    
    // ძებნის ფუნქციონალის ინიციალიზაცია
    initSearchFunctionality();
});

// ===== კარუსელის ფოტოების ჩატვირთვის ფუნქცია =====
async function loadCarouselImages() {
    try {
        console.log('Loading carousel images from API...');
        const response = await fetch('/api/carousel');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Carousel API response:', data);
        
        if (data.success && data.images && data.images.length > 0) {
            renderCarouselImages(data.images);
        } else {
            console.log('No carousel images found, using default images');
            renderDefaultCarouselImages();
        }
    } catch (error) {
        console.error('Error loading carousel images from API:', error);
        console.log('Falling back to default carousel images');
        renderDefaultCarouselImages();
    }
}

// კარუსელის ფოტოების რენდერი API-დან
function renderCarouselImages(images) {
    const carouselContainer = document.getElementById('carouselContainer');
    if (!carouselContainer) return;
    
    // დალაგება რიგის მიხედვით
    const sortedImages = images.sort((a, b) => a.order - b.order);
    
    carouselContainer.innerHTML = sortedImages.map((image, index) => `
        <div class="carousel-slide ${index === 0 ? 'active' : ''}">
            <img src="${image.url}" alt="კარუსელის ფოტო">
        </div>
    `).join('');
    
    // კარუსელის ინიციალიზაცია
    initMainCarousel();
}

// ნაგულისხმები კარუსელის ფოტოების რენდერი
function renderDefaultCarouselImages() {
    const carouselContainer = document.getElementById('carouselContainer');
    if (!carouselContainer) return;
    
    carouselContainer.innerHTML = `
        <!-- კარუსელის პირველი სლაიდი (აქტიური) -->
        <div class="carousel-slide active">
            <img src="/static/photos/car (1).jpg">
        </div>
        <!-- კარუსელის მეორე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (2).jpg">
        </div>
        <!-- კარუსელის მესამე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (3).jpg">
        </div>
        <!-- კარუსელის მეოთხე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (4).jpg">
        </div>
        <!-- კარუსელის მეხუთე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (5).jpg">
        </div>
        <!-- კარუსელის მეექვსე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (6).jpg">
        </div>
        <!-- კარუსელის მეშვიდე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (7).jpg">
        </div>
        <!-- კარუსელის მერვე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (8).jpg">
        </div>
        <!-- კარუსელის მეცხრე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (9).jpg">
        </div>
        <!-- კარუსელის მეათე სლაიდი -->
        <div class="carousel-slide">
            <img src="/static/photos/car (10).jpg">
        </div>
    `;
    
    // კარუსელის ინიციალიზაცია
    initMainCarousel();
}

// მთავარი კარუსელის ინიციალიზაცია
function initMainCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    let currentSlide = 0;
    
    if (slides.length === 0) return;
    
    // ავტომატური სლაიდების შეცვლა
    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }
    
    // კარუსელის ავტომატური გაშვება (5 წამში ერთხელ)
    setInterval(nextSlide, 5000);
}

// ===== ძებნის ფუნქციონალი =====
let allProjects = []; // ყველა პროექტი
let filteredProjects = []; // ფილტრირებული პროექტები
let currentSearchTerm = ''; // მიმდინარე ძებნის ტერმინი
let searchMode = false; // ძებნის რეჟიმი
let searchCurrentIndex = 0; // მიმდინარე ნაპოვნი პროექტის ინდექსი

// ძებნის ფუნქციონალის ინიციალიზაცია
function initSearchFunctionality() {
    const searchInput = document.getElementById('projectSearchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const searchResultsInfo = document.getElementById('searchResultsInfo');
    const searchResultsCount = document.getElementById('searchResultsCount');
    
    if (!searchInput || !searchBtn || !clearSearchBtn) return;
    
    // ძებნის ღილაკის event listener
    searchBtn.addEventListener('click', performSearch);
    
    // წმენდის ღილაკის event listener
    clearSearchBtn.addEventListener('click', clearSearch);
    
    // Enter ღილაკის event listener
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // რეალ-ტაიმ ძებნა
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.trim();
        if (searchTerm.length >= 2) {
            performSearch();
        } else if (searchTerm.length === 0) {
            clearSearch();
        }
    });
    
    // ძებნის შესრულება
    function performSearch() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        currentSearchTerm = searchTerm;
        
        if (searchTerm.length < 2) {
            clearSearch();
            return;
        }
        
        // პროექტების ფილტრაცია
        filteredProjects = allProjects.filter(project => {
            const title = (project.title || '').toLowerCase();
            const description = (project.description || '').toLowerCase();
            const area = (project.area || '').toLowerCase();
            
            return title.includes(searchTerm) || 
                   description.includes(searchTerm) || 
                   area.includes(searchTerm);
        });
        
        console.log(`Search term: "${searchTerm}"`);
        console.log(`Found ${filteredProjects.length} projects:`, filteredProjects.map(p => p.title));
        
        // ძებნის რეჟიმის განახლება
        searchMode = filteredProjects.length > 0;
        searchCurrentIndex = 0;
        
        // შედეგების ჩვენება
        updateSearchResults();
        updateCarouselDisplay();
        
        // ძებნის ღილაკების განახლება
        searchBtn.style.display = 'none';
        clearSearchBtn.style.display = 'flex';
    }
    
    // ძებნის წმენდა
    function clearSearch() {
        searchInput.value = '';
        currentSearchTerm = '';
        filteredProjects = [];
        searchMode = false;
        searchCurrentIndex = 0;
        
        // ყველა პროექტის ჩვენება
        updateSearchResults();
        updateCarouselDisplay();
        
        // ძებნის ღილაკების განახლება
        searchBtn.style.display = 'flex';
        clearSearchBtn.style.display = 'none';
    }
    
    // ძებნის შედეგების განახლება
    function updateSearchResults() {
        if (currentSearchTerm) {
            searchResultsCount.textContent = filteredProjects.length;
            searchResultsInfo.style.display = 'block';
        } else {
            searchResultsInfo.style.display = 'none';
        }
    }
    
    // კარუსელის ჩვენების განახლება
    function updateCarouselDisplay() {
        const cardsContainer = document.querySelector('.cards-container');
        if (!cardsContainer) return;
        
        const projectCards = cardsContainer.querySelectorAll('.project-card');
        
        if (searchMode && filteredProjects.length > 0) {
            // ძებნის რეჟიმი - ყველა პროექტი ჩანს, ნაპოვნი ხაზგასმულია
            
            projectCards.forEach((card) => {
                const projectId = card.dataset.projectId;
                const isFound = filteredProjects.some(project => project.id == projectId);
                
                // ყველა ქარდი ჩანს
                card.style.display = 'block';
                card.style.opacity = '1';
                
                // ნაპოვნი ქარდები ხაზგასმულია
                if (isFound) {
                    card.classList.add('search-highlighted');
                } else {
                    card.classList.remove('search-highlighted');
                }
            });
            
            // პირველი ნაპოვნი პროექტისკენ სქროლვა
            const firstFoundCard = cardsContainer.querySelector('.project-card.search-highlighted');
            if (firstFoundCard) {
                scrollToCard(firstFoundCard);
            }
        } else {
            // ჩვეულებრივი რეჟიმი - ყველა პროექტი ჩანს
            
            projectCards.forEach(card => {
                card.style.display = 'block';
                card.style.opacity = '1';
                card.classList.remove('search-highlighted');
            });
            
            // კარუსელის საწყის პოზიციაზე დაბრუნება
            cardsContainer.style.transform = 'translateX(0px)';
        }
    }
    
}

// კონკრეტულ ქარდზე სქროლვის ფუნქცია (გლობალური)
function scrollToCard(targetCard) {
    const cardsContainer = document.querySelector('.cards-container');
    if (!cardsContainer || !targetCard) return;
    
    const projectCards = cardsContainer.querySelectorAll('.project-card');
    const cardIndex = Array.from(projectCards).indexOf(targetCard);
    
    if (cardIndex === -1) return;
    
    // Get responsive card dimensions based on screen width
    let cardWidth, cardGap;
    
    if (window.innerWidth <= 600) {
        cardWidth = 280;
        cardGap = 40;
    } else if (window.innerWidth <= 900) {
        cardWidth = 380;
        cardGap = 40;
    } else {
        cardWidth = 620;
        cardGap = 40;
    }
    
    const cardTotalWidth = cardWidth + cardGap;
    const containerWidth = window.innerWidth;
    const centerOffset = (containerWidth - cardWidth) / 2;
    const translateX = -cardIndex * cardTotalWidth + centerOffset;
    
    cardsContainer.style.transition = 'transform 0.5s ease-in-out';
    cardsContainer.style.transform = `translateX(${translateX}px)`;
}
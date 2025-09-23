document.addEventListener('DOMContentLoaded', function() {
    // --- Element selections ---
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
    
    // Global variable to track authentication status
    let userAuthenticated = false;
    let currentUser = null;
    
    // --- Authentication Status Check ---
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
            
            // Make authentication status available globally
            window.userAuthenticated = userAuthenticated;
        } catch (error) {
            console.error('Error checking auth status:', error);
            userAuthenticated = false;
            currentUser = null;
            updateAuthButtons('login');
            window.userAuthenticated = false;
        }
    }
    
    // --- Update Authentication Buttons ---
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
            // Show My Page buttons when logged in
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
            // Hide My Page buttons when not logged in
            if (myPageBtn) {
                myPageBtn.style.display = 'none';
            }
            if (mobileMyPageBtn) {
                mobileMyPageBtn.style.display = 'none';
            }
        }
    }
    
    // --- Logout Handler ---
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
    
    // --- Modal Management ---
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

    // Add close listeners to all close buttons
    document.querySelectorAll('.auth-modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.auth-modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // --- Authentication Button Events ---
    // These will be set by updateAuthButtons function based on auth status

    // --- Modal Switching ---
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
    
    // --- Login Form Submission ---
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

    // --- Registration Form Submission ---
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


    // --- Mobile Menu ---
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

    // --- Projects Button ---
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

    // --- Team Carousel ---
let teamCurrentSlide = 0;
let teamIsTransitioning = false;

function initTeamCarousel() {
    const teamCarousel = document.querySelector('.team-carousel-container');
    const teamSlides = document.querySelectorAll('.team-slide');
    const prevBtn = document.getElementById('teamCarouselPrev');
    const nextBtn = document.getElementById('teamCarouselNext');
    
    if (!teamCarousel || !teamSlides.length) return;
    
        // Initialize slides
    teamSlides.forEach(slide => {
        slide.style.opacity = '0';
        slide.style.transform = 'translateX(100%)';
        slide.style.transition = 'none';
    });
    
    if (teamSlides[0]) {
        teamSlides[0].style.opacity = '1';
        teamSlides[0].style.transform = 'translateX(0)';
    }
    
    // Event listeners
        if (nextBtn) nextBtn.addEventListener('click', () => moveTeamSlide(1));
        if (prevBtn) prevBtn.addEventListener('click', () => moveTeamSlide(-1));
    
        // Keyboard navigation
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
    
        // Hide current slide
    const currentSlide = teamSlides[teamCurrentSlide];
    if (currentSlide) {
        currentSlide.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        currentSlide.style.opacity = '0';
        currentSlide.style.transform = direction === 1 ? 'translateX(-100%)' : 'translateX(100%)';
    }
    
        // Show next/previous slide
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

    // --- Projects Carousel ---
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
    
        // Create cards container
    cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    cardsWrapper.appendChild(cardsContainer);
    
        // Initialize
    await loadCardsFromAPI();
    renderProjectsCards();
    
    // Event listeners
    prevBtn.addEventListener('click', () => moveCarousel(-1));
    nextBtn.addEventListener('click', () => moveCarousel(1));
    
    // Recalculate position on window resize
    window.addEventListener('resize', () => {
        updateCarouselPosition();
    });
}

    // Load cards from API
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
                    area: project.area,
                    image: project.main_image_url,
                    link: `card-detail.html?id=${project.id}`,
                    is_liked: project.is_liked,
                    likes_count: project.likes_count,
                    photos: allPhotos
                };
            });
            
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
        area: card.area,
        image: card.image,
        link: `card-detail.html?id=card-${index}`,
        photos: [{
            url: card.image,
            title: 'მთავარი ფოტო'
        }]
    }));
    
    totalCards = projectsCards.length;
}

function renderProjectsCards() {
        if (!cardsContainer || !projectsCards.length) return;
    
    cardsContainer.innerHTML = '';
    
        projectsCards.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'project-card';
            cardElement.setAttribute('data-original-index', index);
            cardElement.setAttribute('data-project-id', card.id);
            
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
            
            cardsContainer.appendChild(cardElement);
        });
}

function moveCarousel(direction) {
    if (projectsIsTransitioning || !projectsCards.length) return;
    
    projectsIsTransitioning = true;
    
        currentCardIndex = (currentCardIndex + direction + totalCards) % totalCards;
        updateCarouselPosition();
        
        setTimeout(() => {
            projectsIsTransitioning = false;
        }, 300);
}

function updateCarouselPosition() {
    if (!cardsContainer) return;
    
    // Get carousel container width
    const carouselContainer = document.querySelector('.section-2 .projects-scroll-1 .carousel-container');
        const containerWidth = carouselContainer ? carouselContainer.offsetWidth : 1200;
    
    // Card width + gap = 310px + 10px = 320px
    const cardTotalWidth = 320;
    
    // Calculate center offset: (container width - card width) / 2
    const centerOffset = (containerWidth - 310) / 2;
    
        const translateX = -currentCardIndex * cardTotalWidth + centerOffset;
        cardsContainer.style.transition = 'transform 0.3s ease-in-out';
        cardsContainer.style.transform = `translateX(${translateX}px)`;
}

function updateCarouselButtons() {
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    
    if (prevBtn && nextBtn) {
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    }
}

    // --- Gallery functionality ---
function openGalleryForCard(card) {
    // Store card data for gallery modal
    window.selectedCard = card;
    
    // Open gallery modal
    openGalleryModal(card);
}

    // --- Gallery Modal functionality ---
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
        slide.innerHTML = `<img src="${photoUrl}" alt="Photo ${index + 1}">`;
        carouselContainer.appendChild(slide);
        
        // Create dot
        const dot = document.createElement('button');
        dot.className = `dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => goToGallerySlide(index));
        dotsContainer.appendChild(dot);
    });
    
    // Update variables
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

    // --- Like functionality ---
async function handleLikeClick(projectId, likeButton) {
    try {
        const response = await fetch(`/api/projects/${projectId}/like`, {
            method: 'POST',
                headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Update button visual state
            updateLikeButton(likeButton, data.liked, data.likes_count);
            
            // Update the project card data
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

// Update like button visual state
function updateLikeButton(likeButton, isLiked, likesCount) {
    const svg = likeButton.querySelector('svg');
    
    if (isLiked) {
        likeButton.classList.add('liked');
        svg.setAttribute('fill', '#ffffff');
        svg.setAttribute('stroke', '#ffffff');
    } else {
        likeButton.classList.remove('liked');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', '#ffffff');
    }
}

// Update project card data in the projectsCards array
function updateProjectCardData(projectId, isLiked, likesCount) {
    projectsCards.forEach(card => {
        if (card.id == projectId) {
            card.is_liked = isLiked;
            card.likes_count = likesCount;
        }
    });
}

    // --- Initialize everything ---
    initTeamCarousel();
    initProjectsCarousel().catch(error => {
        console.error('Error initializing projects carousel:', error);
    });
    initGalleryModal();
    
    // Check authentication status on page load
    checkAuthStatus();
});
document.addEventListener('DOMContentLoaded', function() {
    // --- All element selections are now INSIDE this function ---
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const contactModal = document.getElementById('contactModal');

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    const authBtn = document.getElementById('authBtn');
    const mobileAuthBtn = document.getElementById('mobileAuthBtn');

    const showRegisterModalLink = document.getElementById('showRegisterModal');
    const showLoginModalLink = document.getElementById('showLoginModal');
    
    // --- Modal Closing Logic ---
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    }

    // Add close listeners to all close buttons
    document.querySelectorAll('.contact-modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.contact-modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // --- Modal Opening Logic ---
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    if (authBtn) {
        authBtn.addEventListener('click', () => openModal('loginModal'));
    }
    if (mobileAuthBtn) {
        mobileAuthBtn.addEventListener('click', () => openModal('loginModal'));
    }

    // Links to switch between login and register modals
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
            console.log('Login form submit event fired!'); // Debugging line
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
                    alert('წარმატებით შეხვედით სისტემაში!');
                    window.location.reload(); // Reload the page on successful login
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
            console.log('Register form submit event fired!'); // Debugging line
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

    // --- Contact Form Submission ---
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('.contact-submit-btn');
            const originalText = submitBtn.textContent;
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'გაგზავნა...';
            
            try {
                // Get form data
                const formData = new FormData(contactForm);
                const senderEmail = formData.get('senderEmail');
                const message = formData.get('message');
                
                // Validate required fields
                if (!senderEmail || !message) {
                    alert('გთხოვთ შეავსოთ ყველა ველი');
                    return;
                }
                
                // Prepare JSON data for API
                const contactData = {
                    senderEmail: senderEmail,
                    message: message
                };
                
                console.log('Sending contact form data:', contactData);
                
                // Send POST request to API
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(contactData)
                });
                
                const result = await response.json();
                console.log('Contact form response:', result);
                
                if (response.ok && result.success) {
                    // Success
                    alert('წერილი წარმატებით გაიგზავნა!');
                    closeModal('contactModal');
                } else {
                    // Error
                    const errorMessage = result.error || 'შეცდომა წერილის გაგზავნისას';
                    alert(`შეცდომა: ${errorMessage}`);
                }
                
            } catch (error) {
                console.error('Error sending contact form:', error);
                alert('შეცდომა სერვერთან კავშირისას. გთხოვთ სცადოთ მოგვიანებით.');
            } finally {
                // Reset button state
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // --- Mobile Menu Functionality ---
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

    // Event listeners for mobile menu
    if (burger) {
        burger.addEventListener('click', toggleMobileMenu);
    }
    
    document.querySelectorAll('.mobile-nav-link, .mobile-contact-btn, #mobileNavClose').forEach(btn => {
        btn.addEventListener('click', closeMobileMenu);
    });

    // --- Projects Button ---
    const projectsBtn = document.querySelector('.projects-btn');
    if (projectsBtn) {
        projectsBtn.addEventListener('click', () => {
            window.open('https://gipc.ge', '_blank');
        });
    }

    // --- Close mobile menu on window resize ---
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
        
        // ინიციალიზაცია
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
        
        // კლავიატურის კონტროლი
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
        
        // მიმდინარე სლაიდი ფარული
        const currentSlide = teamSlides[teamCurrentSlide];
        if (currentSlide) {
            currentSlide.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            currentSlide.style.opacity = '0';
            currentSlide.style.transform = direction === 1 ? 'translateX(-100%)' : 'translateX(100%)';
        }
        
        // შემდეგი/წინა სლაიდი
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
    let isInfiniteMode = true;

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
        
        // Check if returning from gallery and set carousel position
        const returnToCardIndex = sessionStorage.getItem('returnToCardIndex');
        
        if (returnToCardIndex !== null) {
            console.log('Returning from gallery, setting card index to:', returnToCardIndex);
            currentCardIndex = parseInt(returnToCardIndex);
            sessionStorage.removeItem('returnToCardIndex');
            
            setTimeout(() => {
                updateCarouselPosition();
                updateCarouselButtons();
            }, 100);
        }
        
        // Refresh mechanism for when projects are updated
        window.addEventListener('projectsUpdated', async function() {
            console.log('Projects updated event received');
            await loadCardsFromAPI();
            renderProjectsCards();
            setTimeout(() => {
                updateCarouselPosition();
                updateCarouselButtons();
            }, 100);
        });
        
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            updateCarouselPosition();
            updateCarouselButtons();
        }, 100);
        
        // Event listeners
        prevBtn.addEventListener('click', () => moveCarousel(-1));
        nextBtn.addEventListener('click', () => moveCarousel(1));
        
        // Recalculate position on window resize
        window.addEventListener('resize', () => {
            updateCarouselPosition();
        });
    }

    // ქარდების ჩატვირთვა API-დან
    async function loadCardsFromAPI() {
        try {
            console.log('Loading cards from API...');
            const response = await fetch('/api/projects');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('API response:', data);
            
            if (data.success && data.projects) {
                // Convert API data to the format expected by the carousel
                projectsCards = data.projects.map(project => ({
                    id: project.id,
                    area: project.area,
                    image: project.main_image_url,
                    link: `card-detail.html?id=${project.id}`,
                    is_liked: project.is_liked,
                    likes_count: project.likes_count,
                    photos: project.photos.map(photoUrl => ({
                        url: photoUrl,
                        title: 'პროექტის ფოტო'
                    }))
                }));
                
                totalCards = projectsCards.length;
                console.log('Loaded cards from API:', projectsCards);
                console.log('Total cards:', totalCards);
            } else {
                console.log('API returned no projects, creating sample cards');
                createRandomCards();
            }
        } catch (error) {
            console.error('Error loading cards from API:', error);
            console.log('Creating sample cards as fallback');
            createRandomCards();
        }
    }

    function createRandomCards() {
        console.log('Creating random cards...');
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
        console.log('Created random cards:', projectsCards);
    }

    function renderProjectsCards() {
        console.log('Rendering projects cards...');
        console.log('cardsContainer:', cardsContainer);
        console.log('projectsCards length:', projectsCards.length);
        
        if (!cardsContainer || !projectsCards.length) {
            console.log('Cannot render cards - missing container or no cards');
            return;
        }
        
        cardsContainer.innerHTML = '';
        
        // For infinite scrolling, we need to duplicate cards
        // Create 3 sets: previous, current, next for seamless looping
        const cardSets = isInfiniteMode ? 3 : 1;
        
        for (let set = 0; set < cardSets; set++) {
            projectsCards.forEach((card, index) => {
                console.log('Rendering card:', card);
                const cardElement = document.createElement('div');
                cardElement.className = 'project-card';
                cardElement.setAttribute('data-original-index', index);
                cardElement.setAttribute('data-set', set);
                cardElement.setAttribute('data-project-id', card.id);
                
                // Create like button HTML (only for authenticated users)
                const likeButtonHtml = (card.is_liked !== undefined && window.userAuthenticated) ? `
                    <button class="like-btn ${card.is_liked ? 'liked' : ''}" data-project-id="${card.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${card.is_liked ? '#ff4757' : 'none'}" stroke="${card.is_liked ? '#ff4757' : '#ffffff'}" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span class="likes-count">${card.likes_count || 0}</span>
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
                    console.log('Card clicked:', card);
                    console.log('Current scroll position before click:', window.pageYOffset || document.documentElement.scrollTop);
                    
                    // Store the original index of the card
                    card.originalIndex = index;
                    
                    // Store current scroll position to prevent unwanted scrolling
                    const currentScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
                    sessionStorage.setItem('currentScrollPosition', currentScrollPosition.toString());
                    
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
    }

    function moveCarousel(direction) {
        if (projectsIsTransitioning || !projectsCards.length) return;
        
        projectsIsTransitioning = true;
        
        if (isInfiniteMode) {
            // For infinite mode, we need to handle the 3 sets of cards
            currentCardIndex += direction;
            updateCarouselPosition();
            
            // Check if we need to reset position for seamless loop
            setTimeout(() => {
                if (currentCardIndex >= totalCards) {
                    // We've moved past the first set, reset to middle set
                    currentCardIndex = currentCardIndex % totalCards;
                    resetCarouselPosition();
                } else if (currentCardIndex < 0) {
                    // We've moved before the first set, reset to middle set
                    currentCardIndex = totalCards + (currentCardIndex % totalCards);
                    resetCarouselPosition();
                }
                projectsIsTransitioning = false;
            }, 300);
        } else {
            // Original behavior for non-infinite mode
            currentCardIndex = (currentCardIndex + direction + totalCards) % totalCards;
            updateCarouselPosition();
            
            setTimeout(() => {
                projectsIsTransitioning = false;
            }, 300);
        }
    }

    function updateCarouselPosition() {
        if (!cardsContainer) return;
        
        // Get carousel container width
        const carouselContainer = document.querySelector('.section-2 .projects-scroll-1 .carousel-container');
        const containerWidth = carouselContainer ? carouselContainer.offsetWidth : 1200; // fallback width
        
        // Card width + gap = 310px + 10px = 320px
        const cardTotalWidth = 320;
        
        // Calculate center offset: (container width - card width) / 2
        const centerOffset = (containerWidth - 310) / 2;
        
        if (isInfiniteMode) {
            // For infinite mode, we need to account for the duplicated cards
            // Start from the middle set (index = totalCards)
            const adjustedIndex = currentCardIndex + totalCards;
            const translateX = -adjustedIndex * cardTotalWidth + centerOffset;
            
            cardsContainer.style.transition = 'transform 0.3s ease-in-out';
            cardsContainer.style.transform = `translateX(${translateX}px)`;
        } else {
            // Original behavior
            const translateX = -currentCardIndex * cardTotalWidth + centerOffset;
            cardsContainer.style.transition = 'transform 0.3s ease-in-out';
            cardsContainer.style.transform = `translateX(${translateX}px)`;
        }
    }

    function resetCarouselPosition() {
        if (!cardsContainer || !isInfiniteMode) return;
        
        // Disable transition for instant reset
        cardsContainer.style.transition = 'none';
        
        // Get carousel container width
        const carouselContainer = document.querySelector('.section-2 .projects-scroll-1 .carousel-container');
        const containerWidth = carouselContainer ? carouselContainer.offsetWidth : 1200;
        
        // Card width + gap = 310px + 10px = 320px
        const cardTotalWidth = 320;
        const centerOffset = (containerWidth - 310) / 2;
        
        // Reset to middle set position
        const adjustedIndex = currentCardIndex + totalCards;
        const translateX = -adjustedIndex * cardTotalWidth + centerOffset;
        
        cardsContainer.style.transform = `translateX(${translateX}px)`;
        
        // Re-enable transition after a brief delay
        setTimeout(() => {
            cardsContainer.style.transition = 'transform 0.3s ease-in-out';
        }, 50);
    }

    function updateCarouselButtons() {
        const prevBtn = document.getElementById('carouselPrev');
        const nextBtn = document.getElementById('carouselNext');
        
        if (prevBtn && nextBtn) {
            prevBtn.disabled = false;
            nextBtn.disabled = false;
        }
    }

    // --- Gallery functionality for card details ---
    function openGalleryForCard(card) {
        console.log('Opening gallery for card:', card);
        
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
        const gallerySaveBtn = document.getElementById('gallerySaveBtn');
        const galleryPrevBtn = document.getElementById('galleryPrevBtn');
        const galleryNextBtn = document.getElementById('galleryNextBtn');
        
        if (!galleryModal) return;
        
        // Event listeners
        if (galleryCloseBtn) galleryCloseBtn.addEventListener('click', closeGalleryModal);
        if (gallerySaveBtn) gallerySaveBtn.addEventListener('click', saveGallery);
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
                } else if (e.key === 's' || e.key === 'S') {
                    e.preventDefault();
                    saveGallery();
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
            // Use photos from the selected card (which now comes from API)
            if (window.selectedCard && window.selectedCard.photos && window.selectedCard.photos.length > 0) {
                console.log('Using photos from selected card:', window.selectedCard.photos);
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

    // Save gallery function
    function saveGallery() {
        console.log('გალერია შენახულია!');
        alert('გალერია შენახულია! (ეს ფუნქცია მომავალში განვითარდება)');
    }

    // --- Like functionality ---
    async function handleLikeClick(projectId, likeButton) {
        try {
            const response = await fetch(`/api/projects/${projectId}/like`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
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
        const likesCountSpan = likeButton.querySelector('.likes-count');
        
        if (isLiked) {
            likeButton.classList.add('liked');
            svg.setAttribute('fill', '#ff4757');
            svg.setAttribute('stroke', '#ff4757');
        } else {
            likeButton.classList.remove('liked');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', '#ffffff');
        }
        
        if (likesCountSpan) {
            likesCountSpan.textContent = likesCount;
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
});
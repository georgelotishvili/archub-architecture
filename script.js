// მთავარი ფუნქცია
document.addEventListener('DOMContentLoaded', function() {
    // ცვლადები
    const elements = {
        burger: document.querySelector('.burger-menu'),
        panel: document.getElementById('mobileNavPanel'),
        icon: document.querySelector('.burger-icon'),
        body: document.body,
        contactModal: document.getElementById('contactModal'),
        contactBtn: document.querySelector('.contact-btn'),
        mobileContactBtn: document.querySelector('.mobile-contact-btn'),
        contactModalClose: document.getElementById('contactModalClose'),
        contactForm: document.getElementById('contactForm'),
        projectsBtn: document.querySelector('.projects-btn')
    };

    // გვერდი ზედიდან იწყება
    window.scrollTo(0, 0);

    // მობილური მენიუ
    function toggleMobileMenu() {
        elements.panel.classList.toggle('active');
        elements.icon.classList.toggle('active');
        elements.body.classList.toggle('nav-open');
    }

    function closeMobileMenu() {
        elements.panel.classList.remove('active');
        elements.icon.classList.remove('active');
        elements.body.classList.remove('nav-open');
    }

    // Event listeners
    elements.burger?.addEventListener('click', toggleMobileMenu);
    document.querySelectorAll('.mobile-nav-link, .mobile-contact-btn, #mobileNavClose').forEach(btn => {
        btn.addEventListener('click', closeMobileMenu);
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // Contact Modal
    function openContactModal() {
        elements.contactModal.classList.add('active');
        elements.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('senderEmail')?.focus(), 100);
    }

    function closeContactModal() {
        elements.contactModal.classList.remove('active');
        elements.body.style.overflow = '';
        elements.contactForm?.reset();
    }

    // Modal events
    elements.contactBtn?.addEventListener('click', openContactModal);
    elements.mobileContactBtn?.addEventListener('click', openContactModal);
    elements.contactModalClose?.addEventListener('click', closeContactModal);

    // Projects button
    elements.projectsBtn?.addEventListener('click', () => {
        window.open('https://gipc.ge', '_blank');
    });

    // Modal close events
    elements.contactModal?.addEventListener('click', (e) => {
        if (e.target === elements.contactModal) closeContactModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.contactModal?.classList.contains('active')) {
            closeContactModal();
        }
    });

    // Form submission
    elements.contactForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const submitBtn = elements.contactForm.querySelector('.contact-submit-btn');
        const originalText = submitBtn.textContent;
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'გაგზავნა...';
        
        const formData = new FormData(elements.contactForm);
        const senderEmail = formData.get('senderEmail');
        const message = formData.get('message');
        const recipientEmail = formData.get('recipientEmail');
        
        const subject = encodeURIComponent('კონტაქტი Archub.ge-დან');
        const body = encodeURIComponent(`გამგზავნი: ${senderEmail}\n\nწერილი:\n${message}`);
        
        window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
        
        setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            closeContactModal();
            alert('წერილი წარმატებით გაიგზავნა');
        }, 1000);
    });

    // Close mobile menu on window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) closeMobileMenu();
    });

    // კარუსელების ინიციალიზაცია
    initTeamCarousel();
    initProjectsCarousel();
});

// Team Carousel
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
    nextBtn?.addEventListener('click', () => moveTeamSlide(1));
    prevBtn?.addEventListener('click', () => moveTeamSlide(-1));
    
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

// Projects Carousel
let projectsCards = [];
let currentCardIndex = 0;
let projectsIsTransitioning = false;
let cardsContainer = null;
let totalCards = 0; // Total number of original cards
let isInfiniteMode = true; // Enable infinite scrolling

function initProjectsCarousel() {
    const cardsWrapper = document.getElementById('cardsWrapper');
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    
    if (!cardsWrapper || !prevBtn || !nextBtn) return;
    
    // ქარდების კონტეინერის შექმნა
    cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    cardsWrapper.appendChild(cardsContainer);
    
    // ინიციალიზაცია
    loadCardsFromStorage();
    renderProjectsCards();
    
    // localStorage-ში ცვლილებების მონიტორინგი
    window.addEventListener('storage', function(e) {
        console.log('Storage event received:', e);
        if (e.key === 'adminCards') {
            console.log('adminCards storage event detected');
            loadCardsFromStorage();
            renderProjectsCards();
            setTimeout(() => {
                updateCarouselPosition();
                updateCarouselButtons();
            }, 100);
        }
    });
    
    // Manual refresh button for debugging (commented out)
    /*
    const refreshButton = document.createElement('button');
    refreshButton.textContent = '🔄 Refresh Cards';
    refreshButton.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; padding: 10px; background: #ff6633; color: white; border: none; border-radius: 5px; cursor: pointer;';
    refreshButton.onclick = function() {
        console.log('Manual refresh triggered');
        loadCardsFromStorage();
        renderProjectsCards();
        setTimeout(() => {
            updateCarouselPosition();
            updateCarouselButtons();
        }, 100);
    };
    document.body.appendChild(refreshButton);
    */
    
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

// ქარდების ჩატვირთვა localStorage-იდან
function loadCardsFromStorage() {
    try {
        console.log('Loading cards from storage...');
        let savedCards = localStorage.getItem('adminCards');
        
        // თუ localStorage-ში არ არის, სცადოს sessionStorage-ში
        if (!savedCards) {
            console.log('No cards in localStorage, checking sessionStorage...');
            try {
                savedCards = sessionStorage.getItem('adminCards');
                if (savedCards) {
                    console.log('Found cards in sessionStorage');
                }
            } catch (sessionError) {
                console.warn('sessionStorage access failed:', sessionError);
            }
        }
        
        console.log('Raw saved cards from main page:', savedCards);
        
        if (savedCards) {
            projectsCards = JSON.parse(savedCards);
            totalCards = projectsCards.length;
            console.log('Loaded cards from storage:', projectsCards);
            console.log('Total cards:', totalCards);
        } else {
            console.log('No cards in storage, creating random cards');
            // თუ storage-ში არ არის, ნიმუშები შევქმნათ
            createRandomCards();
        }
    } catch (error) {
        console.error('Error loading cards from storage:', error);
        console.log('Creating random cards as fallback');
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
            cardElement.innerHTML = `
                <img src="${card.image}" class="card-image">
                <div class="card-info">
                    <div class="card-area">${card.area}</div>
                </div>
            `;
            
            cardElement.addEventListener('click', () => {
                console.log('Card clicked:', card);
                console.log('Card link:', card.link);
                if (card.link) {
                    console.log('Navigating to:', card.link);
                    window.location.href = card.link;
                } else {
                    console.log('No link found for card');
                }
            });
            
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


// Helper functions
function refreshProjectsCarousel() {
    renderProjectsCards();
    
    // For infinite mode, start at the middle set
    if (isInfiniteMode) {
        currentCardIndex = 0; // Reset to first card of middle set
    }
    
    updateCarouselPosition();
    updateCarouselButtons();
}

function clearForm(inputs) {
    inputs.forEach(input => input.value = '');
}

// localStorage და sessionStorage polyfill ძველი ბრაუზერებისთვის
if (!window.localStorage) {
    console.log('localStorage not supported, using memory storage');
    window.localStorage = {
        data: {},
        setItem: function(key, value) {
            this.data[key] = value;
        },
        getItem: function(key) {
            return this.data[key] || null;
        },
        removeItem: function(key) {
            delete this.data[key];
        },
        clear: function() {
            this.data = {};
        }
    };
}

// sessionStorage polyfill ძველი ბრაუზერებისთვის
if (!window.sessionStorage) {
    console.log('sessionStorage not supported, using memory storage');
    window.sessionStorage = {
        data: {},
        setItem: function(key, value) {
            this.data[key] = value;
        },
        getItem: function(key) {
            return this.data[key] || null;
        },
        removeItem: function(key) {
            delete this.data[key];
        },
        clear: function() {
            this.data = {};
        }
    };
}

// Card Detail Page Functions
// ქარდის ID URL-იდან
let cardId = null;

// ქარდის მონაცემების ჩატვირთვა
function loadCardDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    cardId = urlParams.get('id');
    
    console.log('Loading card details for ID:', cardId);
    
    if (!cardId) {
        console.log('Card ID not found');
        return;
    }
    
    try {
        // localStorage-იდან ქარდების ჩატვირთვა
        let savedCards = localStorage.getItem('adminCards');
        
        // თუ localStorage-ში არ არის, სცადოს sessionStorage-ში
        if (!savedCards) {
            console.log('No cards in localStorage, checking sessionStorage...');
            try {
                savedCards = sessionStorage.getItem('adminCards');
                if (savedCards) {
                    console.log('Found cards in sessionStorage');
                }
            } catch (sessionError) {
                console.warn('sessionStorage access failed:', sessionError);
            }
        }
        
        console.log('Raw saved cards from detail page:', savedCards);
        
        if (savedCards) {
            const cards = JSON.parse(savedCards);
            console.log('Parsed cards from detail page:', cards);
            
            const card = cards.find(c => c.id === cardId);
            console.log('Found card:', card);
            
            if (card) {
                displayCardDetails(card);
            } else {
                console.log('Card not found with ID:', cardId);
                showNoCard();
            }
        } else {
            console.log('No cards found in storage');
            showNoCard();
        }
    } catch (error) {
        console.error('Error loading card details:', error);
        showNoCard();
    }
}

// ქარდის დეტალების ჩვენება
function displayCardDetails(card) {
    const cardTitleEl = document.getElementById('cardTitle');
    const cardAreaEl = document.getElementById('cardArea');
    
    if (cardTitleEl) cardTitleEl.textContent = card.title || `ქარდი #${card.id}`;
    if (cardAreaEl) cardAreaEl.textContent = card.area;
    
    const photoCarousel = document.getElementById('photoCarousel');
    const carouselDots = document.getElementById('carouselDots');
    const noPhotos = document.getElementById('noPhotos');
    
    if (card.photos && card.photos.length > 0) {
        // კარუსელის ჩვენება
        if (photoCarousel) photoCarousel.style.display = 'block';
        if (carouselDots) carouselDots.style.display = 'flex';
        if (noPhotos) noPhotos.style.display = 'none';
        
        // კარუსელის ინიციალიზაცია
        initPhotoCarousel(card.photos);
    } else {
        // ფოტოების გარეშე შეტყობინება
        if (photoCarousel) photoCarousel.style.display = 'none';
        if (carouselDots) carouselDots.style.display = 'none';
        if (noPhotos) noPhotos.style.display = 'block';
    }
}

// ქარდი არ მოიძებნა
function showNoCard() {
    const cardTitleEl = document.getElementById('cardTitle');
    const cardAreaEl = document.getElementById('cardArea');
    const noPhotosEl = document.getElementById('noPhotos');
    
    if (cardTitleEl) cardTitleEl.textContent = 'ქარდი არ მოიძებნა';
    if (cardAreaEl) cardAreaEl.textContent = '';
    if (noPhotosEl) noPhotosEl.style.display = 'block';
}

// უკან დაბრუნება
function goBack() {
    window.history.back();
}

// კარუსელის ცვლადები
let currentSlide = 0;
let totalSlides = 0;
let photos = [];

// ფოტო კარუსელის ინიციალიზაცია
function initPhotoCarousel(photoArray) {
    photos = photoArray;
    totalSlides = photos.length;
    currentSlide = 0;
    
    const carouselContainer = document.querySelector('.carousel-container');
    const carouselDots = document.getElementById('carouselDots');
    const carouselCounter = document.getElementById('carouselCounter');
    
    if (!carouselContainer) return;
    
    // სლაიდების შექმნა
    carouselContainer.innerHTML = '';
    photos.forEach((photo, index) => {
        const slide = document.createElement('div');
        slide.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
        slide.innerHTML = `<img src="${photo.url}" alt="${photo.title || `ფოტო ${index + 1}`}">`;
        carouselContainer.appendChild(slide);
    });
    
    // ღილაკების შექმნა
    if (carouselDots) {
        carouselDots.innerHTML = '';
        photos.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => goToSlide(index));
            carouselDots.appendChild(dot);
        });
    }
    
    // მთვლელი
    updateCounter();
    
    // კონტროლების დამატება
    setupCarouselControls();
}

// კარუსელის კონტროლების დაყენება
function setupCarouselControls() {
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    
    if (prevBtn) prevBtn.onclick = () => changeSlide(-1);
    if (nextBtn) nextBtn.onclick = () => changeSlide(1);
    
    // კლავიატურის კონტროლი
    document.addEventListener('keydown', handleKeyboard);
}

// კლავიატურის კონტროლი
function handleKeyboard(e) {
    if (e.key === 'ArrowLeft') {
        changeSlide(-1);
    } else if (e.key === 'ArrowRight') {
        changeSlide(1);
    }
}

// სლაიდის შეცვლა
function changeSlide(direction) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');
    
    if (slides.length === 0) return;
    
    // მიმდინარე სლაიდის ფარული
    slides[currentSlide].classList.remove('active');
    if (dots[currentSlide]) dots[currentSlide].classList.remove('active');
    
    // ახალი ინდექსის გამოთვლა
    currentSlide += direction;
    
    if (currentSlide >= totalSlides) {
        currentSlide = 0;
    } else if (currentSlide < 0) {
        currentSlide = totalSlides - 1;
    }
    
    // ახალი სლაიდის ჩვენება
    slides[currentSlide].classList.add('active');
    if (dots[currentSlide]) dots[currentSlide].classList.add('active');
    
    updateCounter();
}

// კონკრეტულ სლაიდზე გადასვლა
function goToSlide(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');
    
    if (slides.length === 0) return;
    
    // მიმდინარე სლაიდის ფარული
    slides[currentSlide].classList.remove('active');
    if (dots[currentSlide]) dots[currentSlide].classList.remove('active');
    
    // ახალი სლაიდის ჩვენება
    currentSlide = index;
    slides[currentSlide].classList.add('active');
    if (dots[currentSlide]) dots[currentSlide].classList.add('active');
    
    updateCounter();
}

// მთვლელის განახლება
function updateCounter() {
    const counter = document.getElementById('carouselCounter');
    if (counter) {
        counter.textContent = `${currentSlide + 1} / ${totalSlides}`;
    }
}

// გვერდის load/refresh
window.addEventListener('load', () => window.scrollTo(0, 0));

// Card detail page initialization
if (window.location.pathname.includes('card-detail.html')) {
    document.addEventListener('DOMContentLoaded', loadCardDetails);
}
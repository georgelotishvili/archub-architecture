// ===== ARCHUB - მთავარი JavaScript ფაილი =====
// ეს ფაილი შეიცავს მთავარი გვერდის ფუნქციონალს
// ავტორიზაცია, პროექტების ჩატვირთვა, კონტაქტ ფორმა

// ===== Toast Notification სისტემა =====
const Toast = {
    container: null,
    
    init() {
        if (this.container) return;
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    },
    
    show(message, type = 'info', duration = 4000) {
        this.init();
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        this.container.appendChild(toast);
        
        // ავტომატური წაშლა
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
        
        return toast;
    },
    
    success(message, duration) { return this.show(message, 'success', duration); },
    error(message, duration) { return this.show(message, 'error', duration); },
    warning(message, duration) { return this.show(message, 'warning', duration); },
    info(message, duration) { return this.show(message, 'info', duration); }
};

// გლობალურად ხელმისაწვდომი
window.Toast = Toast;

document.addEventListener('DOMContentLoaded', function() {
    // ===== CSRF Token-ის წამოღება =====
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    // ===== უსაფრთხო fetch ფუნქცია =====
    const secureFetch = async (url, options = {}) => {
        // ჰედერების დამატება
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
            ...options.headers,
        };
        
        // მოთხოვნის გაგზავნა
        return fetch(url, { ...options, headers });
    };
    
    // ===== კარუსელის ფოტოების ჩატვირთვა =====
    loadCarouselImages();
    
    // ===== ელემენტების არჩევა =====
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const resetPasswordModal = document.getElementById('resetPasswordModal');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const authBtn = document.getElementById('authBtn');
    const mobileAuthBtn = document.getElementById('mobileAuthBtn');
    const myPageBtn = document.getElementById('myPageBtn');
    const mobileMyPageBtn = document.getElementById('mobileMyPageBtn');
    const showRegisterModalLink = document.getElementById('showRegisterModal');
    const showLoginModalLink = document.getElementById('showLoginModal');
    const showForgotPasswordLink = document.getElementById('showForgotPasswordModal');
    const backToLoginFromForgotLink = document.getElementById('backToLoginFromForgot');
    
    // ===== გლობალური ცვლადები =====
    // ავტორიზაციის სტატუსის თვალყურის დევნება
    let userAuthenticated = false;
    let currentUser = null;
    
    // --- ავტორიზაციის სტატუსის შემოწმება ---
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            userAuthenticated = data.logged_in;
            currentUser = data.logged_in ? data.user : null;
            updateAuthButtons(data.logged_in ? 'logout' : 'login');
            window.userAuthenticated = userAuthenticated;
            
            // სექცია 2 და 3-ის განახლება
            if (typeof loadCardsFromAPI === 'function') {
                try {
                    await loadCardsFromAPI();
                    renderProjectsCards();
                } catch (e) { /* ignore */ }
            }
            if (typeof initSection3Projects === 'function') {
                initSection3Projects().catch(() => {});
            }
        } catch (error) {
            userAuthenticated = false;
            currentUser = null;
            updateAuthButtons('login');
            window.userAuthenticated = false;
        }
    }
    
    // --- ავტორიზაციის ღილაკების განახლება ---
    function updateAuthButtons(state) {
        const userStatus = document.getElementById('userStatus');
        const mobileUserStatus = document.getElementById('mobileUserStatus');
        
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
                myPageBtn.classList.remove('hidden');
                myPageBtn.onclick = () => window.location.href = '/my-page';
            }
            if (mobileMyPageBtn) {
                mobileMyPageBtn.classList.remove('hidden');
                mobileMyPageBtn.onclick = () => window.location.href = '/my-page';
            }
            // მომხმარებლის სახელის ჩვენება
            if (userStatus && currentUser) {
                userStatus.textContent = currentUser.username;
            }
            if (mobileUserStatus && currentUser) {
                mobileUserStatus.textContent = currentUser.username;
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
                myPageBtn.classList.add('hidden');
            }
            if (mobileMyPageBtn) {
                mobileMyPageBtn.classList.add('hidden');
            }
            // "გაიარეთ ავტორიზაცია" ტექსტის ჩვენება
            if (userStatus) {
                userStatus.textContent = 'გაიარეთ ავტორიზაცია';
            }
            if (mobileUserStatus) {
                mobileUserStatus.textContent = 'გაიარეთ ავტორიზაცია';
            }
        }
    }
    
    // --- გასვლის დამუშავება ---
    async function handleLogout() {
        // გაფრთხილება გასვლის წინ
        if (!confirm('ნამდვილად გსურთ სისტემიდან გასვლა?')) {
            return;
        }
        
        try {
            const response = await secureFetch('/api/logout', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                userAuthenticated = false;
                currentUser = null;
                window.userAuthenticated = false;
                updateAuthButtons('login');
                await loadCardsFromAPI();
                renderProjectsCards();
                if (typeof initSection3Projects === 'function') {
                    initSection3Projects().catch(() => {});
                }
                Toast.success('წარმატებით გამოხვედით სისტემიდან!');
                setTimeout(() => window.location.href = '/', 1500);
            } else {
                Toast.error('შეცდომა გასვლისას: ' + (data.error || 'უცნობი შეცდომა'));
            }
        } catch (error) {
            Toast.error('შეცდომა სერვერთან კავშირისას.');
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
                const response = await secureFetch('/api/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                const result = await response.json();

                if (result.success) {
                    userAuthenticated = true;
                    currentUser = result.user;
                    window.userAuthenticated = true;
                    updateAuthButtons('logout');
                    await loadCardsFromAPI();
                    renderProjectsCards();
                    if (typeof initSection3Projects === 'function') {
                        initSection3Projects().catch(() => {});
                    }
                    // ადმინის ლინკის ჩვენება თუ ადმინია
                    if (result.user && result.user.is_admin) {
                        const adminLinkContainer = document.getElementById('adminLinkContainer');
                        if (adminLinkContainer) {
                            adminLinkContainer.classList.remove('hidden');
                        }
                    }
                    Toast.success('წარმატებით შეხვედით სისტემაში!');
                    closeModal('loginModal');
                } else {
                    Toast.error('შეცდომა: ' + result.error);
                }
            } catch (error) {
                Toast.error('სერვერთან დაკავშირების შეცდომა.');
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
            const first_name = document.getElementById('registerFirstName').value;
            const last_name = document.getElementById('registerLastName').value;
            const email = document.getElementById('registerEmail').value;
            const phone = document.getElementById('registerPhone').value;
            const password = document.getElementById('registerPassword').value;
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'რეგისტრაცია...';

            try {
                const response = await secureFetch('/api/register', {
                    method: 'POST',
                    body: JSON.stringify({ first_name, last_name, email, phone, password })
                });
                const result = await response.json();

                if (result.success) {
                    Toast.success(result.message);
                    closeModal('registerModal');
                    openModal('loginModal');
                } else {
                    Toast.error('შეცდომა: ' + result.error);
                }
            } catch (error) {
                Toast.error('სერვერთან დაკავშირების შეცდომა.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'რეგისტრაცია';
            }
        });
    }

    // --- პაროლის აღდგენის მოდალის გახსნა ---
    if (showForgotPasswordLink) {
        showForgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal('loginModal');
            openModal('forgotPasswordModal');
        });
    }

    // --- უკან შესვლაზე დაბრუნება ---
    if (backToLoginFromForgotLink) {
        backToLoginFromForgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal('forgotPasswordModal');
            openModal('loginModal');
        });
    }

    // --- პაროლის აღდგენის მოთხოვნის ფორმა ---
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgotEmail').value;
            const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'იგზავნება...';

            try {
                const response = await secureFetch('/api/forgot-password', {
                    method: 'POST',
                    body: JSON.stringify({ email })
                });
                const result = await response.json();

                if (result.success) {
                    Toast.success(result.message);
                    closeModal('forgotPasswordModal');
                    document.getElementById('forgotEmail').value = '';
                } else {
                    Toast.error('შეცდომა: ' + result.error);
                }
            } catch (error) {
                Toast.error('სერვერთან დაკავშირების შეცდომა.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'გაგზავნა';
            }
        });
    }

    // --- პაროლის შეცვლის ფორმა (reset token-ით) ---
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = document.getElementById('resetToken').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const submitBtn = resetPasswordForm.querySelector('button[type="submit"]');

            if (newPassword !== confirmPassword) {
                Toast.error('პაროლები არ ემთხვევა');
                return;
            }

            if (newPassword.length < 6) {
                Toast.error('პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'შეცვლა...';

            try {
                const response = await secureFetch('/api/reset-password', {
                    method: 'POST',
                    body: JSON.stringify({ token, password: newPassword })
                });
                const result = await response.json();

                if (result.success) {
                    Toast.success('პაროლი წარმატებით შეიცვალა!');
                    closeModal('resetPasswordModal');
                    // URL-დან token პარამეტრის წაშლა
                    window.history.replaceState({}, document.title, window.location.pathname);
                    openModal('loginModal');
                } else {
                    Toast.error('შეცდომა: ' + result.error);
                }
            } catch (error) {
                Toast.error('სერვერთან დაკავშირების შეცდომა.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'შეცვლა';
            }
        });
    }

    // --- Reset token-ის შემოწმება URL-დან ---
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    if (resetToken) {
        document.getElementById('resetToken').value = resetToken;
        openModal('resetPasswordModal');
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


    // --- პროექტების კარუსელი ---
let projectsCards = [];
let currentCardIndex = 0;
let projectsIsTransitioning = false;
let cardsContainer = null;
let totalCards = 0;

// Lazy loading observer სურათებისთვის
const lazyImageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const element = entry.target;
            const bgImage = element.dataset.bgImage;
            if (bgImage) {
                element.style.backgroundImage = `url('${bgImage}')`;
                element.removeAttribute('data-bg-image');
                lazyImageObserver.unobserve(element);
            }
        }
    });
}, {
    rootMargin: '100px', // იწყებს ჩატვირთვას 100px-ით ადრე
    threshold: 0.01
});

window.initProjectsCarousel = async function initProjectsCarousel() {
    // Use the existing Section 2 container directly
    cardsContainer = document.getElementById('cardsWrapper');
    if (!cardsContainer) return;

    await loadCardsFromAPI();
    renderProjectsCards();
    
    // Initialize Section 2 arrows
    initSection2Arrows();
}

// ===== სექცია 3 - პროექტების გრიდი =====
window.initSection3Projects = async function initSection3Projects() {
    const projectsGrid = document.getElementById('projectsGrid');
    if (!projectsGrid) return;
    
    try {
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success && data.projects) {
            projectsGrid.innerHTML = '';
            data.projects.forEach(project => {
                projectsGrid.appendChild(createSection3CardElement(project));
            });
        } else {
            projectsGrid.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">პროექტები ვერ ჩაიტვირთა</div>';
        }
    } catch (error) {
        projectsGrid.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">შეცდომა პროექტების ჩატვირთვისას</div>';
    }
}

// Create card element for section 3
function createSection3CardElement(project) {
    const cardElement = document.createElement('div');
    cardElement.className = 'project-card';
    cardElement.setAttribute('data-project-id', project.id);
    
    // Create like button HTML (only for authenticated users)
    const likeButtonHtml = (window.userAuthenticated) ? `
        <button class="like-btn ${project.is_liked ? 'liked' : ''}" data-project-id="${project.id}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${project.is_liked ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
        </button>
    ` : '';
    
    cardElement.innerHTML = `
        <img src="${project.main_image_url}" class="card-image" alt="${escapeHtml(project.area)}" loading="lazy">
        <div class="card-info">
            <div class="card-area">${escapeHtml(project.area)}</div>
        </div>
        ${likeButtonHtml}
    `;
    
    // Add click event to open gallery
    cardElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // ფოტოების მასივის აწყობა - მთავარი ფოტო ყოველთვის პირველი
        let allPhotos = [];
        const mainUrl = project.main_image_url;
        
        if (project.photos?.length > 0) {
            if (mainUrl && project.photos.includes(mainUrl)) {
                allPhotos.push({ url: mainUrl, title: 'მთავარი ფოტო' });
                project.photos.forEach(url => {
                    if (url !== mainUrl) {
                        allPhotos.push({ url, title: 'პროექტის ფოტო' });
                    }
                });
            } else {
                allPhotos = project.photos.map(url => ({ url, title: 'პროექტის ფოტო' }));
            }
        } else if (mainUrl) {
            allPhotos.push({ url: mainUrl, title: 'მთავარი ფოტო' });
        }
        
        // Create project object with photos array
        const projectWithPhotos = {
            id: project.id,
            area: project.area,
            main_image_url: mainUrl,
            photos: allPhotos,
            is_liked: project.is_liked,
            likes_count: project.likes_count
        };
        
        // Open gallery modal (same as section 2)
        openGalleryForCard(projectWithPhotos);
    });
    
    // Add like button click event listener
    const likeBtn = cardElement.querySelector('.like-btn');
    if (likeBtn) {
        likeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLikeClick(project.id, likeBtn);
        });
    }
    
    return cardElement;
}

    // ქარდების ჩატვირთვა API-დან
async function loadCardsFromAPI() {
    try {
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success && data.projects) {
            projectsCards = data.projects.map(project => {
                // ფოტოების მასივის აწყობა - მთავარი ფოტო ყოველთვის პირველი
                let allPhotos = [];
                const mainUrl = project.main_image_url;
                
                if (project.photos?.length > 0) {
                    // ჯერ მთავარი ფოტო (თუ არის და photos-ში შედის)
                    if (mainUrl && project.photos.includes(mainUrl)) {
                        allPhotos.push({ url: mainUrl, title: 'მთავარი ფოტო' });
                        // დანარჩენი ფოტოები (მთავარის გარდა)
                        project.photos.forEach(url => {
                            if (url !== mainUrl) {
                                allPhotos.push({ url, title: 'პროექტის ფოტო' });
                            }
                        });
                    } else {
                        // თუ main_image_url არ არის photos-ში, უბრალოდ photos
                        allPhotos = project.photos.map(url => ({ url, title: 'პროექტის ფოტო' }));
                    }
                } else if (mainUrl) {
                    allPhotos.push({ url: mainUrl, title: 'მთავარი ფოტო' });
                }
                
                return {
                    id: project.id,
                    title: project.title || '',
                    description: project.description || '',
                    area: project.area,
                    image: mainUrl,
                    link: `card-detail.html?id=${project.id}`,
                    is_liked: project.is_liked,
                    likes_count: project.likes_count,
                    photos: allPhotos
                };
            });
            
            allProjects = [...projectsCards];
            totalCards = projectsCards.length;
        } else {
            createRandomCards();
        }
    } catch (error) {
        createRandomCards();
    }
}

function createRandomCards() {
    const sampleCards = [
        { area: '120 კვ.მ', image: 'images/pro 1.png' },
        { area: '150 კვ.მ', image: 'images/pro 2.jpg' },
        { area: '90 კვ.მ', image: 'images/pro 3.png' },
        { area: '200 კვ.მ', image: 'images/pro 4.jpg' },
        { area: '180 კვ.მ', image: 'images/pro 5.jpg' }
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
    cardsContainer.innerHTML = '';
    projectsCards.forEach((card, index) => {
        cardsContainer.appendChild(createCardElement(card, index));
    });
}

function createCardElement(card, index) {
    const cardElement = document.createElement('div');
    cardElement.className = 'project-card';
    cardElement.setAttribute('data-original-index', index);
    cardElement.setAttribute('data-project-id', card.id);
    
    // Lazy loading - სურათი ჩაიტვირთება როცა ხილული გახდება
    if (card.image) {
        cardElement.dataset.bgImage = card.image;
        cardElement.style.backgroundSize = 'cover';
        cardElement.style.backgroundPosition = 'center';
        cardElement.style.backgroundRepeat = 'no-repeat';
        cardElement.style.backgroundColor = '#e0e0e0'; // placeholder ფერი
        lazyImageObserver.observe(cardElement);
    }
    
    // Create like button HTML (only for authenticated users)
    const likeButtonHtml = (window.userAuthenticated) ? `
        <button class="like-btn ${card.is_liked ? 'liked' : ''}" data-project-id="${card.id}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${card.is_liked ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
        </button>
    ` : '';
    
    cardElement.innerHTML = `
        <div class="card-info">
            <div class="card-area">${escapeHtml(card.area)}</div>
            ${card.title ? `<div class="card-title" style="display: none;">${escapeHtml(card.title)}</div>` : ''}
            ${card.description ? `<div class="card-description" style="display: none;">${escapeHtml(card.description)}</div>` : ''}
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
    if (!cardsContainer) return;
    const projectCards = cardsContainer.querySelectorAll('.project-card');
    if (!projectCards.length) return;
    
    // მარტივი ნავიგაცია - ინდექსი შემოფარგლული ქარდების რაოდენობით
    currentCardIndex = Math.max(0, Math.min(projectCards.length - 1, currentCardIndex + direction));
    projectCards[currentCardIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
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

// resetCarouselPositionIfNeeded წაშლილია - აღარ არის საჭირო მარტივი კარუსელისთვის

function updateCarouselPosition() {
    if (!cardsContainer) return;
    const cards = cardsContainer.querySelectorAll('.project-card');
    if (!cards.length) return;
    // center by direct scrollLeft math to avoid unexpected snapping
    const card = cards[currentCardIndex];
    const cardRect = card.getBoundingClientRect();
    const containerRect = cardsContainer.getBoundingClientRect();
    const delta = (cardRect.left + cardRect.width / 2) - (containerRect.left + containerRect.width / 2);
    cardsContainer.scrollLeft += delta;
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
        if (window.selectedCard?.photos?.length > 0) {
            displayGalleryPhotos(window.selectedCard.photos);
            gallery.style.display = 'block';
            noPhotos.classList.add('hidden');
            return;
        }
        gallery.style.display = 'none';
        noPhotos.classList.remove('hidden');
    } catch (error) {
        gallery.style.display = 'none';
        noPhotos.classList.remove('hidden');
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
    
    carouselContainer.innerHTML = '';
    dotsContainer.innerHTML = '';
    
    photos.forEach((photo, index) => {
        const slide = document.createElement('div');
        slide.className = `slide ${index === 0 ? 'active' : ''}`;
        const photoUrl = typeof photo === 'string' ? photo : photo.url;
        
        const likeButtonHtml = window.userAuthenticated ? `
            <button class="gallery-like-btn ${window.selectedCard.is_liked ? 'liked' : ''}" data-project-id="${window.selectedCard.id}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="${window.selectedCard.is_liked ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="2">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                </svg>
            </button>
        ` : '';
        
        slide.innerHTML = `<img src="${photoUrl}" alt="Photo ${index + 1}" loading="${index === 0 ? 'eager' : 'lazy'}">${likeButtonHtml}`;
        carouselContainer.appendChild(slide);
        
        const dot = document.createElement('button');
        dot.className = `dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => goToGallerySlide(index));
        dotsContainer.appendChild(dot);
    });
    
    document.querySelectorAll('.gallery-like-btn').forEach(btn => {
        if (btn && window.selectedCard) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLikeClick(window.selectedCard.id, btn);
            });
        }
    });
    
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
    if (!window.userAuthenticated) {
        Toast.warning('შესვლა გჭირდებათ პროექტის მოსაწონებლად.');
        return;
    }
    
    try {
        const response = await secureFetch(`/api/projects/${projectId}/like`, { method: 'POST' });
        const data = await response.json();
        
        if (response.ok && data.success) {
            updateLikeButton(likeButton, data.liked, data.likes_count);
            updateProjectCardData(projectId, data.liked, data.likes_count);
            
            const eventName = data.liked ? 'projectLiked' : 'projectUnliked';
            const storageKey = data.liked ? 'projectLiked' : 'projectUnliked';
            
            localStorage.setItem(storageKey, JSON.stringify({ projectId, timestamp: Date.now() }));
            window.dispatchEvent(new CustomEvent(eventName, { detail: { projectId } }));
        } else {
            if (response.status === 401) {
                Toast.warning('შესვლა გჭირდებათ პროექტის მოსაწონებლად.');
            } else {
                Toast.error(`შეცდომა: ${data.error || 'შეცდომა მოწონებისას'}`);
            }
        }
    } catch (error) {
        Toast.error('შეცდომა სერვერთან კავშირისას.');
    }
}

// ყველა ლაიქის ღილაკის განახლება იგივე პროექტისთვის
function updateAllLikeButtonsForProject(projectId, isLiked) {
    document.querySelectorAll(`[data-project-id="${projectId}"]`).forEach(button => {
        if (button.classList.contains('like-btn') || button.classList.contains('gallery-like-btn')) {
            const svg = button.querySelector('svg');
            if (svg) {
                button.classList.toggle('liked', isLiked);
                svg.setAttribute('fill', isLiked ? '#ffffff' : 'none');
                svg.setAttribute('stroke', '#ffffff');
            }
        }
    });
}

// მოწონების ღილაკის ვიზუალური მდგომარეობის განახლება
function updateLikeButton(likeButton, isLiked, likesCount) {
    updateAllLikeButtonsForProject(likeButton.getAttribute('data-project-id'), isLiked);
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
    
    // სინქრონიზაცია ახლა updateLikeButton ფუნქციით ხდება
}


    // --- რეალ-ტაიმ განახლების ფუნქციონალი ---
    function setupRealtimeUpdates() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'projectLiked' || e.key === 'projectUnliked') {
                const data = JSON.parse(e.newValue);
                updateAllLikeButtonsForProject(data.projectId, e.key === 'projectLiked');
            }
        });
        
        window.addEventListener('projectLiked', (e) => updateAllLikeButtonsForProject(e.detail.projectId, true));
        window.addEventListener('projectUnliked', (e) => updateAllLikeButtonsForProject(e.detail.projectId, false));
    }

    // --- ყველაფრის ინიციალიზაცია ---
    checkAuthStatus();
    initProjectsCarousel().catch(() => {});
    initSection3Projects().catch(() => {});
    initGalleryModal();
    setupRealtimeUpdates();
    initSearchFunctionality();
});

// ადმინის პანელის გახსნა
function openAdminPanel() {
    // გახსნას ადმინის გვერდი იგივე ფანჯარაში
    window.location.href = '/admin';
}

// ===== კარუსელის ფოტოების ჩატვირთვის ფუნქცია =====
async function loadCarouselImages() {
    try {
        const response = await fetch('/api/carousel');
        if (!response.ok) throw new Error('API error');
        
        const data = await response.json();
        if (data.success && data.images?.length > 0) {
            renderCarouselImages(data.images);
        }
        // თუ ფოტოები არ არის, კარუსელი უბრალოდ ცარიელი რჩება
    } catch (error) {
        // შეცდომის შემთხვევაში არაფერი არ ვაკეთოთ
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
            <img src="${image.url}" alt="კარუსელის ფოტო" loading="${index === 0 ? 'eager' : 'lazy'}">
        </div>
    `).join('');
    
    // კარუსელის ინიციალიზაცია
    initMainCarousel();
}

// მთავარი კარუსელის ინიციალიზაცია
let carouselInterval = null;

function initMainCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    let currentSlide = 0;
    
    if (slides.length === 0) return;
    
    // წინა interval-ის გასუფთავება (memory leak-ის თავიდან აცილება)
    if (carouselInterval) {
        clearInterval(carouselInterval);
    }
    
    // ავტომატური სლაიდების შეცვლა
    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }
    
    // კარუსელის ავტომატური გაშვება (5 წამში ერთხელ)
    carouselInterval = setInterval(nextSlide, 5000);
}

// ===== ძებნის ფუნქციონალი =====
let allProjects = [];
let filteredProjects = [];
let currentSearchTerm = '';
let searchMode = false;
let searchCurrentIndex = 0;

function initSearchFunctionality() {
    const searchInput = document.getElementById('projectSearchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (!searchInput || !searchBtn || !clearSearchBtn) return;
    
    function performSearch() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        currentSearchTerm = searchTerm;
        
        if (searchTerm.length < 2) {
            clearSearch();
            return;
        }
        
        filteredProjects = allProjects.filter(p => 
            (p.title || '').toLowerCase().includes(searchTerm) || 
            (p.description || '').toLowerCase().includes(searchTerm) || 
            (p.area || '').toLowerCase().includes(searchTerm)
        );
        
        searchMode = filteredProjects.length > 0;
        searchCurrentIndex = 0;
        updateCarouselDisplay();
        
        searchBtn.classList.add('hidden');
        clearSearchBtn.classList.remove('hidden');
    }
    
    function clearSearch() {
        searchInput.value = '';
        currentSearchTerm = '';
        filteredProjects = [];
        searchMode = false;
        searchCurrentIndex = 0;
        updateCarouselDisplay();
        
        searchBtn.classList.remove('hidden');
        clearSearchBtn.classList.add('hidden');
    }
    
    function updateCarouselDisplay() {
        const cardsContainer = document.querySelector('.cards-container');
        if (!cardsContainer) return;
        
        const projectCards = cardsContainer.querySelectorAll('.project-card');
        
        if (searchMode && filteredProjects.length > 0) {
            projectCards.forEach(card => {
                const isFound = filteredProjects.some(p => p.id == card.dataset.projectId);
                card.style.display = isFound ? 'block' : 'none';
                card.classList.toggle('search-highlighted', isFound);
            });
            
            const firstFoundCard = cardsContainer.querySelector('.project-card.search-highlighted');
            if (firstFoundCard) scrollToCard(firstFoundCard);
        } else {
            projectCards.forEach(card => {
                card.style.display = 'block';
                card.style.opacity = '1';
                card.classList.remove('search-highlighted');
            });
            cardsContainer.style.transform = 'translateX(0px)';
        }
    }
    
    searchBtn.addEventListener('click', performSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') performSearch(); });
    searchInput.addEventListener('input', function() {
        if (this.value.trim().length >= 2) performSearch();
        else if (this.value.trim().length === 0) clearSearch();
    });
}

// კონკრეტულ ქარდზე სქროლვის ფუნქცია (გლობალური)
function scrollToCard(targetCard) {
    const container = document.getElementById('cardsWrapper');
    if (!container || !targetCard) return;
    
    // იყენებს კონტეინერის scrollLeft-ს გვერდის სქროლვის ნაცვლად
    const containerRect = container.getBoundingClientRect();
    const cardRect = targetCard.getBoundingClientRect();
    const scrollLeft = cardRect.left - containerRect.left + container.scrollLeft - (containerRect.width / 2) + (cardRect.width / 2);
    
    container.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
    });
}

// სექცია 2-ის ისრების ფუნქციონალი
function initSection2Arrows() {
    const prevBtn = document.getElementById('section2PrevBtn');
    const nextBtn = document.getElementById('section2NextBtn');
    const container = document.getElementById('cardsWrapper');
    
    if (!prevBtn || !nextBtn || !container) return;
    
    // ყველაზე ახლო ქარდის პოვნა ცენტრთან
    function findClosestCard(cards) {
        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;
        let closestCard = null, minDistance = Infinity;
        
        cards.forEach(card => {
            const cardRect = card.getBoundingClientRect();
            const distance = Math.abs(cardRect.left + cardRect.width / 2 - containerCenter);
            if (distance < minDistance) {
                minDistance = distance;
                closestCard = card;
            }
        });
        return closestCard;
    }
    
    // ნავიგაცია მითითებული მიმართულებით
    function navigate(direction) {
        const cards = Array.from(container.querySelectorAll('.project-card'));
        if (cards.length === 0) return;
        
        const closestCard = findClosestCard(cards);
        if (!closestCard) return;
        
        const currentIndex = cards.indexOf(closestCard);
        const newIndex = direction === -1 
            ? (currentIndex > 0 ? currentIndex - 1 : cards.length - 1)
            : (currentIndex < cards.length - 1 ? currentIndex + 1 : 0);
        
        scrollToCard(cards[newIndex]);
    }
    
    prevBtn.addEventListener('click', () => navigate(-1));
    nextBtn.addEventListener('click', () => navigate(1));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"'`=\/]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[c]));
}
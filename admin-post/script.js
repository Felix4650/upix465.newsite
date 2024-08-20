// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.13.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.13.0/firebase-analytics.js";
import { getStorage, ref, uploadBytes, getDownloadURL, listAll, deleteObject } from "https://www.gstatic.com/firebasejs/9.13.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAn4bIBUn5s0IOR80LGzBuUJmLUIR0tlII",
    authDomain: "upix465.firebaseapp.com",
    databaseURL: "https://upix465-default-rtdb.firebaseio.com",
    projectId: "upix465",
    storageBucket: "upix465.appspot.com",
    messagingSenderId: "583899372251",
    appId: "1:583899372251:web:6d06ba0e057c51a5b4cafe",
    measurementId: "G-F723WJVJKY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const storage = getStorage(app);

document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById('fileInput');
    const imgBox = document.getElementById('imgBox');
    const deleteModal = document.getElementById('deleteModal');
    const loginModal = document.getElementById('loginModal');
    const loginForm = document.getElementById('loginForm');
    const customAlertModal = document.getElementById('customAlertModal');
    const customAlertMessage = document.getElementById('customAlertMessage');
    let imageToDelete = null;
    let adminPassword = null;

    const showLoginModal = () => {
        loginModal.style.display = 'block';
    };

    const closeLoginModal = () => {
        loginModal.style.display = 'none';
    };

    const showCustomAlert = (message) => {
        customAlertMessage.textContent = message;
        customAlertModal.style.display = 'block';
    };

    const closeCustomAlert = () => {
        customAlertModal.style.display = 'none';
    };

    // Handle login form submission
    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const passwordInput = document.getElementById('passwordInput').value;

        fetch('/verify-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: passwordInput })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message === 'Login successful') {
                adminPassword = passwordInput;
                closeLoginModal();
                showCustomAlert('Login successful!');
            } else {
                showCustomAlert('Incorrect admin password.');
            }
        })
        .catch(error => console.error('Error during login:', error));
    });

    const triggerFileInput = () => {
        if (!adminPassword) {
            showCustomAlert('You must be logged in as admin to upload images.');
            showLoginModal();
            return;
        }
        fileInput.click();
    };
    
    // Ensure the function is accessible globally
    window.triggerFileInput = triggerFileInput;


    const loadImages = () => {
        const storageRef = ref(storage, 'images/');
        listAll(storageRef)
            .then((res) => {
                imgBox.innerHTML = ''; // Clear existing images
                res.items.forEach((itemRef) => {
                    getDownloadURL(itemRef)
                        .then((url) => {
                            const imgElement = document.createElement('div');
                            imgElement.classList.add('image');
                            imgElement.innerHTML = `
                                <img src="${url}" alt="Uploaded Image">
                                <button class="delete-btn" data-path="${itemRef.fullPath}">Delete</button>
                            `;
                            imgBox.appendChild(imgElement);
                        })
                        .catch((error) => {
                            console.error('Error getting image URL:', error);
                        });
                });
            })
            .catch((error) => {
                console.error('Error listing images:', error);
            });
    };

    loadImages(); // Load images on page load

    const loadFile = (event) => {
        const file = event.target.files[0]; // Get the selected file
        if (file && adminPassword) {
            const storageRef = ref(storage, 'images/' + file.name);
            uploadBytes(storageRef, file)
                .then(() => {
                    showCustomAlert('Image uploaded successfully.');
                    loadImages(); // Reload images to display the newly uploaded image
                })
                .catch((error) => {
                    showCustomAlert('Image upload failed.');
                    console.error('Error uploading image:', error);
                });
        } else {
            showCustomAlert('You must be logged in as admin to upload images.');
        }
    };

    const showDeleteModal = (filePath) => {
        if (!adminPassword) {
            showCustomAlert('You must be logged in as admin to delete images.');
            showLoginModal();
            return;
        }
        deleteModal.style.display = 'block';
        imageToDelete = filePath; // Store the file path of the image to delete
    };

    const closeModal = () => {
        deleteModal.style.display = 'none';
        imageToDelete = null;
    };

    const confirmDelete = () => {
        const deleteRef = ref(storage, imageToDelete); // Get the reference to the file to delete
        deleteObject(deleteRef)
            .then(() => {
                closeModal();
                showCustomAlert('Image deleted successfully.');
                loadImages(); // Reload images after deletion
            })
            .catch((error) => {
                showCustomAlert('Image deletion failed.');
                console.error('Error deleting image:', error);
            });
    };

    imgBox.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-btn')) {
            showDeleteModal(event.target.dataset.path);
        }
    });

    window.triggerFileInput = triggerFileInput;
    window.loadFile = loadFile;
    window.closeModal = closeModal;
    window.confirmDelete = confirmDelete;
    window.showCustomAlert = showCustomAlert;
    window.closeCustomAlert = closeCustomAlert;
    window.showLoginModal = showLoginModal;
    window.closeLoginModal = closeLoginModal;
});

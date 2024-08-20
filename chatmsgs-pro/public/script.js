const socket = io();

const loginBtn = document.getElementById('login-btn');
const usernameInput = document.getElementById('username');
const userRegDiv = document.querySelector('.user-reg');
const chatContainer = document.querySelector('.chat-container');

loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        sessionStorage.setItem('username', username);
        socket.emit('login', username);
        userRegDiv.style.display = 'none';
        chatContainer.style.display = 'block';
        loadMessages();
    }
});

const messageInput = document.getElementById('message-input');
const sendMessageButton = document.getElementById('send-message');
const messagesContainer = document.getElementById('messages');

sendMessageButton.addEventListener('click', () => {
    const message = messageInput.value.trim();
    const username = sessionStorage.getItem('username');
    if (message && username) {
        const data = { message, sender: username };
        socket.emit('sendMessage', data);
        messageInput.value = '';
    }
});

// Listen for incoming messages
socket.on('receiveMessage', (data) => {
    addMessageToContainer(data);
    saveMessageToCookies(data);
});

// Load messages from cookies
function loadMessages() {
    const messages = getMessagesFromCookies();
    messages.forEach(addMessageToContainer);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Function to add messages to the container
function addMessageToContainer(data) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('my-message');
    messageElement.setAttribute('title', `Sent by: ${data.sender}`);
    const textElement = document.createElement('div');
    textElement.classList.add('text');
    textElement.textContent = data.message;
    messageElement.appendChild(textElement);
    messagesContainer.appendChild(messageElement);
}

// Save messages to cookies
function saveMessageToCookies(data) {
    let messages = getMessagesFromCookies();
    messages.push(data);
    document.cookie = `messages=${JSON.stringify(messages)}; path=/; max-age=31536000`;
}

// Get messages from cookies
function getMessagesFromCookies() {
    const cookieValue = document.cookie.split('; ').find(row => row.startsWith('messages='));
    if (cookieValue) {
        return JSON.parse(cookieValue.split('=')[1]);
    }
    return [];
}

// On DOM content loaded, check if the user is already logged in
document.addEventListener('DOMContentLoaded', () => {
    const username = sessionStorage.getItem('username');
    if (username) {
        userRegDiv.style.display = 'none';
        chatContainer.style.display = 'block';
        loadMessages();
    }
});

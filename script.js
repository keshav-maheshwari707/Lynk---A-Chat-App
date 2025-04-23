// 🔧 Firebase Config (replace with your own config)
const firebaseConfig = {
  apiKey: "AIzaSyAXwVuFHsnmiRN-tan7JlsEgsJcESGAjGQ",
  authDomain: "real-time-chat-app-1b00c.firebaseapp.com",
  projectId: "real-time-chat-app-1b00c",
  storageBucket: "real-time-chat-app-1b00c.firebasestorage.app",
  messagingSenderId: "624744882702",
  appId: "1:624744882702:web:52aaf14e05c6f427f2d25f"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 🔐 Signup
function signup() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const name = prompt("Enter your name:");
  auth.createUserWithEmailAndPassword(email, password)
    .then(() => {
      return db.collection("profiles").doc(email).set({ name });
    })
    .then(() => {
      alert("Signed up!");
      window.location = "friends.html";
    })
    .catch(err => alert(err.message));
}

// 🔐 Login
function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      alert("Logged in!");
      window.location = "friends.html";
    })
    .catch(err => alert(err.message));
}

// 🔓 Logout
function logout() {
  auth.signOut().then(() => {
    alert("Logged out!");
    window.location = "index.html";
  });
}

// ➕ Add Friend
function addFriend() {
  const friendEmail = document.getElementById("friendEmail").value;
  const user = auth.currentUser;
  if (!user || !friendEmail) return;

  db.collection("users").doc(user.email).set({
    friends: firebase.firestore.FieldValue.arrayUnion(friendEmail)
  }, { merge: true }).then(() => {
    alert("Friend added!");
    loadFriends();
  });
}

// ❌ Remove Friend
function removeFriend(friendEmail) {
  const user = auth.currentUser;
  if (!user) return;

  db.collection("users").doc(user.email).update({
    friends: firebase.firestore.FieldValue.arrayRemove(friendEmail)
  }).then(() => {
    alert("Friend removed!");
    loadFriends();
  });
}

// 📜 Load Friends
function loadFriends() {
  const user = auth.currentUser;
  if (!user) return;

  db.collection("users").doc(user.email).get().then(async doc => {
    const data = doc.data();
    const friends = data?.friends || [];
    const list = document.getElementById("friendsList");
    list.innerHTML = "";

    for (const friend of friends) {
      const friendDoc = await db.collection("profiles").doc(friend).get();
      const friendName = friendDoc.exists ? friendDoc.data().name : friend;

      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.justifyContent = "space-between";
      container.style.marginBottom = "8px";

      const btn = document.createElement("button");
      btn.textContent = friendName;
      btn.onclick = () => openChat(friend);

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.style.backgroundColor = "#e74c3c";
      removeBtn.style.marginLeft = "10px";
      removeBtn.onclick = () => removeFriend(friend);

      container.appendChild(btn);
      container.appendChild(removeBtn);
      list.appendChild(container);
    }
  });
}

// 🔄 Navigate to chat with friend
function openChat(friend) {
  window.location = `chat.html?friend=${encodeURIComponent(friend)}`;
}

// 💬 Send message in private chat
function sendMessage() {
  const msg = document.getElementById("messageInput").value;
  const user = auth.currentUser;
  const friend = new URLSearchParams(window.location.search).get("friend");
  if (!user || !friend || !msg.trim()) return;

  const room = [user.email, friend].sort().join("_");
  db.collection("messages_" + room).add({
    text: msg,
    user: user.email,
    time: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Clear input
  document.getElementById("messageInput").value = "";

  // Clear typing
  db.collection("typing").doc(room).set({
    [user.email]: false
  }, { merge: true });
}

// 🧽 Clear Chat
function clearChat() {
  const user = auth.currentUser;
  const friend = new URLSearchParams(window.location.search).get("friend");
  if (!user || !friend) return;

  const room = [user.email, friend].sort().join("_");
  db.collection("messages_" + room).get().then(snapshot => {
    const batch = db.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    return batch.commit();
  }).then(() => {
    alert("Chat cleared.");
  });
}

// 🧠 Typing indicator
function setupTypingIndicator(room, userEmail, friendEmail) {
  const input = document.getElementById("messageInput");
  const typingIndicator = document.getElementById("typingIndicator");

  input.addEventListener("input", () => {
    db.collection("typing").doc(room).set({
      [userEmail]: true
    }, { merge: true });

    setTimeout(() => {
      db.collection("typing").doc(room).set({
        [userEmail]: false
      }, { merge: true });
    }, 2000);
  });

  db.collection("typing").doc(room).onSnapshot(doc => {
    const data = doc.data();
    if (data?.[friendEmail]) {
      typingIndicator.style.display = "block";
    } else {
      typingIndicator.style.display = "none";
    }
  });
}

// 📡 Listen for messages in private chat
if (window.location.pathname.includes("chat.html")) {
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location = "index.html";
    } else {
      const friend = new URLSearchParams(window.location.search).get("friend");
      const room = [user.email, friend].sort().join("_");

      // Start typing indicator
      setupTypingIndicator(room, user.email, friend);

      // Listen for messages
      db.collection("messages_" + room)
        .orderBy("time")
        .onSnapshot(snapshot => {
          renderMessages(snapshot);
        });
    }
  });
}

// 👫 Load friends on friends.html
if (window.location.pathname.includes("friends.html")) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location = "index.html";
    } else {
      loadFriends();
    }
  });
}

// 📄 Render chat messages
async function renderMessages(snapshot) {
  const chatBox = document.getElementById("chatBox");
  chatBox.innerHTML = "";

  const friend = new URLSearchParams(window.location.search).get("friend");
  const user = auth.currentUser;

  for (const doc of snapshot.docs) {
    const msg = doc.data();
    const time = msg.time?.toDate().toLocaleTimeString() || "";

    let nameToShow = msg.user;
    const profile = await db.collection("profiles").doc(msg.user).get();
    if (profile.exists) {
      nameToShow = profile.data().name;
    }

    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-message " + (msg.user === user.email ? "sent" : "received");
    msgDiv.innerHTML = `<strong>${nameToShow}:</strong> ${msg.text} <small>(${time})</small>`;
    chatBox.appendChild(msgDiv);
  }

  chatBox.scrollTop = chatBox.scrollHeight;
}

// 🌗 Toggle Dark Mode with icon and label switch
function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");

  const btn = document.getElementById("themeToggleBtn");
  if (isDark) {
    btn.innerHTML = "☀️ Toggle to Light Mode";
  } else {
    btn.innerHTML = "🌙 Toggle to Dark Mode";
  }
}

// 🌗 Apply dark mode and update toggle button on page load
window.addEventListener("load", () => {
  const btn = document.getElementById("themeToggleBtn");
  const isDarkMode = localStorage.getItem("darkMode") === "enabled";

  if (isDarkMode) {
    document.body.classList.add("dark");
    btn.innerHTML = "☀️ Toggle to Light Mode";
  } else {
    btn.innerHTML = "🌙 Toggle to Dark Mode";
  }
});

// Add the following variables at the top of your script.js
let localStream = null;
let peerConnection = null;
const callControls = document.getElementById("callControls");

// Step 1: Get user's media (audio)
async function getMedia() {
  const constraints = { audio: true, video: false };
  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  document.getElementById("remoteAudio").srcObject = localStream;
}

// Step 2: Start the call
async function startCall() {
  await getMedia();

  // Show call controls
  callControls.style.display = "flex";

  // Setup peer connection and create offer
  peerConnection = new RTCPeerConnection();
  peerConnection.addEventListener("icecandidate", event => {
    if (event.candidate) {
      // Send the ICE candidate to the other peer
    }
  });

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // Send offer to the other peer (you would need to integrate signaling here)
}

function endCall() {
  if (peerConnection) {
    // Stop all tracks in the local stream
    localStream.getTracks().forEach(track => {
      track.stop();
    });

    // Close the peer connection
    peerConnection.close();
    peerConnection = null;

    // Hide call controls (UI elements)
    callControls.style.display = "none";

    // Optionally, you can reset the remote audio stream
    const remoteAudio = document.getElementById("remoteAudio");
    remoteAudio.srcObject = null; // Clear the remote audio stream
  }
}


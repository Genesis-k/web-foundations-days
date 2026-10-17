// ELEMENT SELECTIONS & STATE
const loadUsersBtn = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusMessage = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

let usersData = [];

// RENDER FUNCTION (Strict DOM methods)

function renderUsers(list) {
  usersList.textContent = "";

  if (list.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-message";
    emptyItem.textContent = "No users match your filter.";
    usersList.appendChild(emptyItem);
    return;
  }

  list.forEach((user) => {
    const listItem = document.createElement("li");
    listItem.className = "user-card";

    const nameHeading = document.createElement("strong");
    nameHeading.textContent = user.name;

    const emailPara = document.createElement("p");
    emailPara.textContent = `Email: ${user.email}`;

    const cityPara = document.createElement("p");
    cityPara.textContent = `City: ${user.address ? user.address.city : "N/A"}`;

    const companyPara = document.createElement("p");
    companyPara.textContent = `Company: ${user.company ? user.company.name : "N/A"}`;

    listItem.appendChild(nameHeading);
    listItem.appendChild(emailPara);
    listItem.appendChild(cityPara);
    listItem.appendChild(companyPara);

    usersList.appendChild(listItem);
  });
}

// FETCH USERS (async / await / try / catch / finally)
async function loadUsers() {
  loadUsersBtn.disabled = true;
  statusMessage.textContent = "Loading users...";
  usersList.textContent = "";

  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/users");

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    usersData = await response.json();
    statusMessage.textContent = "Users loaded successfully.";
    renderUsers(usersData);
  } catch (error) {
    statusMessage.textContent = `Error loading users: ${error.message}`;
  } finally {
    loadUsersBtn.disabled = false;
  }
}

// CLIENT-SIDE FILTERING

filterInput.addEventListener("input", (event) => {
  const searchTerm = event.target.value.toLowerCase().trim();

  const filteredUsers = usersData.filter((user) =>
    user.name.toLowerCase().includes(searchTerm)
  );

  renderUsers(filteredUsers);
});

loadUsersBtn.addEventListener("click", loadUsers);
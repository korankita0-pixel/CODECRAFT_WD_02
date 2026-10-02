const $ = (selector) => document.querySelector(selector);

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Please log in again.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function showToast(message, isError = false) {
  const toast = $("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Login page
const loginForm = $("#loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = $("#loginMessage");
    const button = loginForm.querySelector("button[type='submit']");
    message.textContent = "";
    button.disabled = true;

    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: $("#username").value.trim(),
          password: $("#password").value,
        }),
      });

      window.location.href = "/dashboard";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

// Dashboard
const employeeTable = $("#employeeTable");

if (employeeTable) {
  let employees = [];

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);

  function renderEmployees() {
    const query = $("#searchInput").value.trim().toLowerCase();

    const filtered = employees.filter((employee) =>
      [
        employee.name,
        employee.email,
        employee.phone,
        employee.department,
        employee.position,
      ].some((value) => String(value).toLowerCase().includes(query))
    );

    $("#totalEmployees").textContent = employees.length;
    $("#totalDepartments").textContent =
      new Set(employees.map((employee) => employee.department.toLowerCase())).size;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    $("#recentEmployees").textContent = employees.filter(
      (employee) => new Date(employee.createdAt).getTime() >= thirtyDaysAgo
    ).length;

    if (!filtered.length) {
      employeeTable.innerHTML = `
        <tr><td colspan="6" class="empty-state">
          ${employees.length ? "No matching employees found." : "No employees yet. Add your first team member!"}
        </td></tr>`;
      return;
    }

    employeeTable.innerHTML = filtered.map((employee) => `
      <tr>
        <td>
          <span class="employee-name">${escapeHTML(employee.name)}</span>
          <span class="employee-email">${escapeHTML(employee.email)}</span>
        </td>
        <td>${escapeHTML(employee.department)}</td>
        <td>${escapeHTML(employee.position)}</td>
        <td>${escapeHTML(employee.phone)}</td>
        <td>${Number(employee.salary).toLocaleString(undefined, {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 2
        })}</td>
        <td>
          <div class="action-group">
            <button class="icon-btn" data-edit="${employee._id}"
              aria-label="Edit ${escapeHTML(employee.name)}" title="Edit">✎</button>
            <button class="icon-btn delete" data-delete="${employee._id}"
              aria-label="Delete ${escapeHTML(employee.name)}" title="Delete">⌫</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  async function loadEmployees() {
    try {
      employees = await api("/api/employees");
      renderEmployees();
    } catch (error) {
      $("#tableMessage").textContent = error.message;
    }
  }

  async function loadAdmin() {
    try {
      const admin = await api("/api/auth/me");
      $("#adminName").textContent = admin.username;
      $(".avatar").textContent = admin.username.charAt(0).toUpperCase();
    } catch (error) {
      // api() redirects to login when the session has expired.
    }
  }

  const modal = $("#employeeModal");
  const form = $("#employeeForm");

  function openModal(employee = null) {
    form.reset();
    $("#employeeFormMessage").textContent = "";
    $("#employeeId").value = employee?._id || "";
    $("#modalTitle").textContent = employee ? "Edit employee" : "Add employee";
    $("#saveEmployeeBtn").textContent = employee ? "Save changes" : "Save employee";

    if (employee) {
      $("#employeeName").value = employee.name;
      $("#employeeEmail").value = employee.email;
      $("#employeePhone").value = employee.phone;
      $("#employeeDepartment").value = employee.department;
      $("#employeePosition").value = employee.position;
      $("#employeeSalary").value = employee.salary;
    }

    modal.classList.remove("hidden");
    $("#employeeName").focus();
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  $("#addEmployeeBtn").addEventListener("click", () => openModal());
  $("#closeModalBtn").addEventListener("click", closeModal);
  $("#cancelModalBtn").addEventListener("click", closeModal);

  modal.querySelector("[data-close-modal]").addEventListener("click", closeModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  $("#searchInput").addEventListener("input", renderEmployees);

  employeeTable.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");

    if (editButton) {
      const employee = employees.find((item) => item._id === editButton.dataset.edit);
      if (employee) openModal(employee);
    }

    if (deleteButton) {
      const employee = employees.find((item) => item._id === deleteButton.dataset.delete);
      if (!employee) return;

      if (!confirm(`Delete ${employee.name}'s record? This cannot be undone.`)) return;

      try {
        const result = await api(`/api/employees/${employee._id}`, {
          method: "DELETE",
        });

        showToast(result.message);
        await loadEmployees();
      } catch (error) {
        showToast(error.message, true);
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = $("#employeeId").value;
    const payload = {
      name: $("#employeeName").value.trim(),
      email: $("#employeeEmail").value.trim(),
      phone: $("#employeePhone").value.trim(),
      department: $("#employeeDepartment").value.trim(),
      position: $("#employeePosition").value.trim(),
      salary: $("#employeeSalary").value,
    };

    const button = $("#saveEmployeeBtn");
    const message = $("#employeeFormMessage");

    button.disabled = true;
    message.textContent = "";

    try {
      const result = await api(
        id ? `/api/employees/${id}` : "/api/employees",
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      closeModal();
      showToast(result.message);
      await loadEmployees();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      showToast(error.message, true);
    }
  });

  loadAdmin();
  loadEmployees();
}
"use strict";

class Contacts {
  constructor({ onListChangeHandler, applyFn }) {
    this.onListChange = onListChangeHandler;
    this.applyFn = applyFn;
    this.list = [];
    this.updateList();
  }

  updateList() {
    return (
      fetch("/api/contacts")
        .then((response) => response.json())
        .then((json) => {
          this.list = json.map(this.applyFn);
          this.onListChange(this.list);
        })
        .catch(console.error)
    );
  }

  get(id) {
    return this.list.find((contact) => contact.id === Number(id));
  }

  add(jsonString) {
    return fetch("/api/contacts", {
      method: "post",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: jsonString,
    })
      .then((response) => response.json())
      .then(() => this.updateList())
      .catch(console.error);
  }

  edit(id, jsonString) {
    return fetch(`/api/contacts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: jsonString,
    })
      .then((response) => response.status)
      .then(() => this.updateList())
      .catch(console.error);
  }

  delete(id) {
    return fetch(`/api/contacts/${id}`, { method: "DELETE" })
      .then((response) => response.status)
      .then(() => this.updateList())
      .catch(console.error);
  }
}

class View {
  constructor(root) {
    const get = (selector) => root.querySelector(selector);
    this.root = root;
    this.panel = get(".panel");
    this.searchInput = get("input[type='search']");
    this.messageDiv = get(".message_box");
    this.main = get(".content");
    this.forms = get(".forms");

    this._templateSetup();
    this.hideMessage();
  }

  bind({
    onSearchHandler,
    onAddHandler,
    onEditHandler,
    onDeleteHandler,
    onTagClickedHandler,
    onTagCancelHandler,
    onTagEditHandler,
    findContactData,
  }) {
    this.forms.addEventListener("submit", (event) => {
      const { target } = event;

      event.preventDefault();
      if (target.checkValidity()) {
        if (target.matches("form.add")) onAddHandler(new FormData(target));

        if (target.matches("form.edit")) onEditHandler(new FormData(target));

        this.hideForm();
      }
    });

    this.forms.addEventListener("reset", () => this.hideForm());

    // sanitize tag inputs
    this.forms.addEventListener("change", (event) => {
      if (!event.target.matches("input#tags")) return;

      onTagEditHandler(event.target);
    });

    this.searchInput.addEventListener("input", (event) =>
      onSearchHandler(event.target.value)
    );

    this.root.addEventListener("click", ({ target }) => {
      if (!target.matches("button")) return;

      const { action, id } = target.dataset;
      switch (action) {
        case "tag_search":
          onTagClickedHandler(target.innerHTML);
          break;
        case "tag_cancel":
          onTagCancelHandler(target);
          break;
        case "add":
          this.showAddForm();
          break;
        case "edit": {
          const { id } = target.dataset;
          const data = findContactData(id);
          this.showEditForm(data);
          break;
        }
        case "delete":
          if (confirm("Are you sure you want to delete this contact?"))
            onDeleteHandler(id);

          break;
      }
    });
  }

  show(contacts) {
    this.main.innerHTML = this.templates["contacts_template"](contacts);
  }

  showCancelTag(tag) {
    this.panel.insertAdjacentHTML(
      "beforeend",
      this.templates["cancel_tag_template"](tag)
    );
  }

  hideCancelTag() {
    this.panel.querySelector("button[data-action='tag_cancel']")?.remove();
  }

  showMessage(text) {
    this.messageDiv.style.display = "";
    this.messageDiv.innerHTML = this.templates["message_box"](text);
  }

  hideMessage() {
    this.messageDiv.style.display = "none";
    this.messageDiv.innerHTML = "";
  }

  showAddForm() {
    this.panel.style.display = "none";
    this.main.style.display = "none";
    this.messageDiv.style.display = "none";
    this.forms.innerHTML = this.templates["add_or_edit_form_template"]();
  }

  showEditForm(contact) {
    this.panel.style.display = "none";
    this.messageDiv.style.display = "none";
    this.main.style.display = "none";
    this.forms.innerHTML = this.templates["add_or_edit_form_template"](contact);
  }

  hideForm() {
    this.panel.style.display = "";
    this.main.style.display = "";
    this.forms.innerHTML = "";
  }

  _templateSetup() {
    this.templates = {};
    document
      .querySelectorAll("script[type$='template']")
      .forEach(({ id, innerHTML }) => {
        this.templates[id] = Handlebars.compile(innerHTML);
      });

    document
      .querySelectorAll("script[type$='partial'")
      .forEach(({ id, innerHTML }) => {
        Handlebars.registerPartial(id, innerHTML);
      });
  }
}

class Manager {
  constructor(rootElement) {
    this.contacts = new Contacts({
      applyFn: ({ tags, ...rest }) => ({
        tags: (tags || "").split(","),
        ...rest,
      }),

      onListChangeHandler: (list) => this.view.show(list),
    });

    this.view = new View(rootElement);
    this.view.bind({
      onSearchHandler: (keywordBegin) => {
        const filtered = this.contacts.list.filter((contact) => {
          return contact.full_name
            .toLowerCase()
            .startsWith(keywordBegin.toLowerCase());
        });

        this.view.show(filtered);
        this.view.hideCancelTag();
        this.view.hideMessage();
        if (keywordBegin.length > 0 && filtered.length === 0)
          this.view.showMessage(
            `There is no matching contact starting with: ${keywordBegin}`
          );
      },

      onAddHandler: (formData) =>
        this.contacts.add(this.toJsonString(formData)),

      onTagClickedHandler: (tag) => {
        const filtered = this.contacts.list.filter(
          ({ tags }) => tags.indexOf(tag) > -1
        );

        this.view.hideCancelTag();
        this.view.showCancelTag(tag);
        this.view.show(filtered);
      },

      onTagCancelHandler: () => {
        this.view.hideCancelTag();
        this.view.show(this.contacts.list);
      },

      onTagEditHandler: (inputEl) => {
        const words = inputEl.value.split(/[,\s]+/);
        const uniqueWords = [...new Set(words)].sort();
        inputEl.value = uniqueWords.join(",");
      },

      onEditHandler: (formData) => {
        const id = formData.get("id");
        const json = this.toJsonString(formData);
        this.contacts.edit(id, json);
      },

      findContactData: (id) => this.contacts.get(id),

      onDeleteHandler: (id) => this.contacts.delete(id),
    });
  }

  toJsonString(formData) {
    const data = Object.create(null);
    [...formData].forEach(([key, value]) => (data[key] = value));
    return JSON.stringify(data);
  }
}

const app = new Manager(document.querySelector('main .wrapper'));

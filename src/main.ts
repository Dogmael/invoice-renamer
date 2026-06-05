import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import {
  applyDocumentLocale,
  getLocale,
  initLocale,
  t,
  translateBackendError,
} from "./i18n";
import { getTheme, initTheme, setTheme, type ThemeMode } from "./theme";

type FileStatus = "pending" | "processing" | "done" | "error";

interface FileEntry {
  id: string;
  path: string;
  name: string;
  previousName?: string;
  size: number;
  status: FileStatus;
  progress: number;
  error?: string;
}

interface FileInfo {
  path: string;
  name: string;
  size: number;
}

interface ProcessProgressEvent {
  path: string;
  status: FileStatus;
  progress: number;
  newPath?: string;
  newName?: string;
  error?: string;
  completedCount?: number;
  totalCount?: number;
}

interface MistralApiKeyInfo {
  hasKey: boolean;
  preview: string | null;
}

interface MistralApiKeyState extends MistralApiKeyInfo {
  validation?: "valid" | "invalid" | null;
}

type ApiKeyValidationState = "unknown" | "checking" | "valid" | "invalid";

const dropZone = document.querySelector<HTMLElement>("#dropZone")!;
const dropZoneContent = document.querySelector<HTMLElement>("#dropZoneContent")!;
const filesView = document.querySelector<HTMLElement>("#filesView")!;
const fileListEl = document.querySelector<HTMLUListElement>("#fileList")!;
const uploadZone = document.querySelector<HTMLElement>("#uploadZone")!;
const addMoreZone = document.querySelector<HTMLElement>("#addMoreZone")!;
const selectButton = document.querySelector<HTMLButtonElement>("#selectButton")!;
const addMoreButton = document.querySelector<HTMLButtonElement>("#addMoreButton")!;
const clearAllButton = document.querySelector<HTMLButtonElement>("#clearAllButton")!;
const processButton = document.querySelector<HTMLButtonElement>("#processButton")!;
const processButtonFill = document.querySelector<HTMLElement>("#processButtonFill")!;
const processButtonLabel = document.querySelector<HTMLElement>("#processButtonLabel")!;
const cancelProcessButton = document.querySelector<HTMLButtonElement>("#cancelProcessButton")!;
const themeDropdown = document.querySelector<HTMLElement>("#themeDropdown")!;
const themeDropdownTrigger = document.querySelector<HTMLButtonElement>("#themeDropdownTrigger")!;
const themeDropdownValue = document.querySelector<HTMLElement>("#themeDropdownValue")!;
const themeDropdownMenu = document.querySelector<HTMLElement>("#themeDropdownMenu")!;
const themeOptions = Array.from(
  document.querySelectorAll<HTMLButtonElement>("#themeDropdownMenu .dropdown__option"),
);
const settingsTooltipLabel = document.querySelector<HTMLElement>("#settingsTooltip")!;
const settingsButton = document.querySelector<HTMLButtonElement>("#settingsButton")!;
const settingsModal = document.querySelector<HTMLElement>("#settingsModal")!;
const settingsBackdrop = document.querySelector<HTMLElement>("#settingsBackdrop")!;
const closeSettingsButton = document.querySelector<HTMLButtonElement>("#closeSettingsButton")!;
const promptSavedStatus = document.querySelector<HTMLElement>("#promptSavedStatus")!;
const promptInput = document.querySelector<HTMLTextAreaElement>("#promptInput")!;
const apiKeyInput = document.querySelector<HTMLInputElement>("#apiKeyInput")!;
const apiKeySavedView = document.querySelector<HTMLElement>("#apiKeySavedView")!;
const apiKeyEditView = document.querySelector<HTMLElement>("#apiKeyEditView")!;
const apiKeyPreviewEl = document.querySelector<HTMLElement>("#apiKeyPreviewEl")!;
const saveApiKeyButton = document.querySelector<HTMLButtonElement>("#saveApiKeyButton")!;
const replaceApiKeyButton = document.querySelector<HTMLButtonElement>("#replaceApiKeyButton")!;
const cancelApiKeyButton = document.querySelector<HTMLButtonElement>("#cancelApiKeyButton")!;
const clearApiKeyButton = document.querySelector<HTMLButtonElement>("#clearApiKeyButton")!;

let files: FileEntry[] = [];
let draggedFileId: string | null = null;
let isProcessing = false;
let batchTotal = 0;
let batchCompleted = 0;
let apiKeyHasStoredKey = false;
let savedKeyPreview: string | null = null;
let isReplacingApiKey = false;
let isSavingApiKey = false;
let apiKeyValidationState: ApiKeyValidationState = "unknown";
let savedPrompt = "";
let promptSavePromise: Promise<boolean> | null = null;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getGlobalProgressPercent(): number {
  if (!isProcessing || batchTotal === 0) {
    return 0;
  }

  const processingFile = files.find((file) => file.status === "processing");
  const currentFileProgress = processingFile?.progress ?? 0;
  const completedBeforeCurrent = processingFile ? batchCompleted : batchTotal;

  return Math.min(
    100,
    Math.round(((completedBeforeCurrent * 100) + currentFileProgress) / batchTotal),
  );
}

function applyCancelledState() {
  isProcessing = false;
  batchTotal = 0;
  batchCompleted = 0;
  cancelProcessButton.disabled = false;
  files.forEach((file) => {
    if (file.status === "processing") {
      file.status = "pending";
      file.progress = 0;
      file.error = undefined;
    }
  });
  renderFileList();
  updateProcessButton();
}

function updateProcessButton() {
  const pendingCount = files.filter((file) => file.status === "pending").length;
  const hasPending = pendingCount > 0;
  const globalPercent = getGlobalProgressPercent();

  processButton.classList.toggle("process-button--processing", isProcessing);
  cancelProcessButton.classList.toggle("hidden", !isProcessing);

  if (isProcessing && batchTotal > 0) {
    const currentIndex = Math.min(batchCompleted + 1, batchTotal);
    processButtonLabel.textContent = t("processingProgress", {
      current: currentIndex,
      total: batchTotal,
      percent: globalPercent,
    });
    processButtonFill.style.width = `${globalPercent}%`;
  } else {
    processButtonLabel.textContent =
      pendingCount === 1
        ? t("processOneFile")
        : t("processManyFiles", { count: pendingCount || files.length });
    processButtonFill.style.width = "0%";
  }

  processButton.disabled = !hasPending && !isProcessing;
  clearAllButton.disabled = isProcessing;
  addMoreButton.disabled = isProcessing;
  selectButton.disabled = isProcessing;
}

function apiKeyHasUnsavedDraft(): boolean {
  return apiKeyInput.value.trim().length > 0;
}

function isApiKeyEditViewVisible(): boolean {
  return !apiKeyHasStoredKey || isReplacingApiKey;
}

function normalizeApiKeyInfo(raw: unknown): MistralApiKeyInfo {
  const info = raw as Record<string, unknown>;
  return {
    hasKey: Boolean(info.hasKey ?? info.has_key),
    preview: typeof info.preview === "string" ? info.preview : null,
  };
}

function normalizeApiKeyState(raw: unknown): MistralApiKeyState {
  const info = raw as Record<string, unknown>;
  const validation = info.validation;

  return {
    ...normalizeApiKeyInfo(raw),
    validation:
      validation === "valid" || validation === "invalid" ? validation : null,
  };
}

function applyApiKeyInfo(info: MistralApiKeyInfo): void {
  apiKeyHasStoredKey = info.hasKey;
  savedKeyPreview = info.preview;
}

function updateApiKeyUi(): void {
  const editViewVisible = isApiKeyEditViewVisible();

  apiKeySavedView.classList.toggle("hidden", editViewVisible);
  apiKeyEditView.classList.toggle("hidden", !editViewVisible);

  if (apiKeyHasStoredKey && !editViewVisible) {
    apiKeyPreviewEl.textContent = savedKeyPreview ?? "**...****";
  }

  const showCancel = editViewVisible && (isReplacingApiKey || apiKeyHasUnsavedDraft());
  cancelApiKeyButton.classList.toggle("hidden", !showCancel);
  saveApiKeyButton.disabled = isSavingApiKey || !apiKeyHasUnsavedDraft();
  saveApiKeyButton.textContent = isSavingApiKey ? t("saveApiKeyValidating") : t("saveApiKey");
}

async function refreshApiKeyState(validateStored = false): Promise<void> {
  const shouldValidate =
    validateStored &&
    apiKeyValidationState !== "valid" &&
    apiKeyValidationState !== "checking";

  if (shouldValidate) {
    apiKeyValidationState = "checking";
    updateApiKeyUi();
  }

  try {
    const state = normalizeApiKeyState(
      await invoke<MistralApiKeyState>("get_mistral_api_key_state", {
        validate: shouldValidate,
      }),
    );
    applyApiKeyInfo(state);
    isReplacingApiKey = false;
    apiKeyInput.value = "";

    if (state.validation === "valid") {
      apiKeyValidationState = "valid";
    } else if (state.validation === "invalid") {
      apiKeyValidationState = "invalid";
    } else if (!state.hasKey) {
      apiKeyValidationState = "unknown";
    } else if (!shouldValidate && apiKeyValidationState === "checking") {
      apiKeyValidationState = "unknown";
    }

    updateApiKeyUi();
  } catch (error) {
    apiKeyValidationState = "unknown";
    updateApiKeyUi();
    console.error(translateBackendError(error instanceof Error ? error.message : String(error)));
  }
}

function setPromptSavedVisible(visible: boolean): void {
  promptSavedStatus.classList.toggle("hidden", !visible);
}

function handlePromptInput(): void {
  setPromptSavedVisible(false);
}

async function savePromptIfNeeded(): Promise<boolean> {
  if (promptSavePromise) {
    return promptSavePromise;
  }

  const prompt = promptInput.value;
  if (prompt === savedPrompt) {
    return true;
  }

  if (prompt.trim().length === 0) {
    return false;
  }

  promptSavePromise = (async () => {
    try {
      await invoke("set_prompt", { prompt });
      savedPrompt = prompt;
      setPromptSavedVisible(true);
      return true;
    } catch (error) {
      console.error(translateBackendError(error instanceof Error ? error.message : String(error)));
      return false;
    }
  })();

  try {
    return await promptSavePromise;
  } finally {
    promptSavePromise = null;
  }
}

async function refreshPromptState(): Promise<void> {
  const prompt = await invoke<string>("get_prompt");
  savedPrompt = prompt;
  promptInput.value = prompt;
  setPromptSavedVisible(false);
}

async function refreshSettingsState(): Promise<void> {
  try {
    await Promise.all([refreshPromptState(), refreshApiKeyState(true)]);
  } catch (error) {
    console.error(translateBackendError(error instanceof Error ? error.message : String(error)));
  }
}

async function openSettings(): Promise<void> {
  settingsModal.classList.remove("hidden");
  await refreshSettingsState();
}

async function requestCloseSettings(): Promise<void> {
  const promptSaved = await savePromptIfNeeded();
  if (!promptSaved) {
    return;
  }

  if (apiKeyHasUnsavedDraft()) {
    const discard = await confirm(t("unsavedApiKeyWarning"), {
      title: t("settingsTitle"),
      kind: "warning",
      okLabel: t("discardChanges"),
      cancelLabel: t("keepEditing"),
    });
    if (!discard) {
      return;
    }
  }

  isReplacingApiKey = false;
  apiKeyInput.value = "";
  closeThemeDropdown();
  settingsModal.classList.add("hidden");
}

function themeOptionLabel(theme: ThemeMode): string {
  const labels: Record<ThemeMode, "themeSystem" | "themeLight" | "themeDark"> = {
    system: "themeSystem",
    light: "themeLight",
    dark: "themeDark",
  };

  return t(labels[theme]);
}

function updateThemeDropdown() {
  const activeTheme = getTheme();
  themeDropdownValue.textContent = themeOptionLabel(activeTheme);

  themeOptions.forEach((option) => {
    const theme = option.dataset.theme as ThemeMode | undefined;
    const isSelected = theme === activeTheme;
    option.classList.toggle("dropdown__option--selected", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
    if (theme) {
      option.textContent = themeOptionLabel(theme);
    }
  });
}

function setThemeDropdownOpen(open: boolean) {
  themeDropdownMenu.classList.toggle("hidden", !open);
  themeDropdownTrigger.setAttribute("aria-expanded", String(open));
}

function closeThemeDropdown() {
  setThemeDropdownOpen(false);
}

function toggleThemeDropdown() {
  setThemeDropdownOpen(themeDropdownMenu.classList.contains("hidden"));
}

function startReplaceApiKey(): void {
  isReplacingApiKey = true;
  apiKeyInput.value = "";
  updateApiKeyUi();
  apiKeyInput.focus();
}

function cancelApiKeyEdit(): void {
  isReplacingApiKey = false;
  apiKeyInput.value = "";
  updateApiKeyUi();
}

async function saveApiKey(): Promise<void> {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    return;
  }

  isSavingApiKey = true;
  updateApiKeyUi();

  try {
    await invoke("validate_mistral_api_key", { apiKey });
    const info = normalizeApiKeyInfo(await invoke("set_mistral_api_key", { apiKey }));
    applyApiKeyInfo(info);
    isReplacingApiKey = false;
    apiKeyInput.value = "";
    isSavingApiKey = false;
    apiKeyValidationState = "valid";
    updateApiKeyUi();
  } catch (error) {
    isSavingApiKey = false;
    console.error(translateBackendError(error instanceof Error ? error.message : String(error)));
    updateApiKeyUi();
  }
}

async function clearApiKey(): Promise<void> {
  try {
    await invoke("clear_mistral_api_key");
    apiKeyHasStoredKey = false;
    savedKeyPreview = null;
    isReplacingApiKey = false;
    apiKeyValidationState = "unknown";
    apiKeyInput.value = "";
    updateApiKeyUi();
  } catch (error) {
    console.error(translateBackendError(error instanceof Error ? error.message : String(error)));
  }
}

function applyProgressUpdate(event: ProcessProgressEvent) {
  const file = files.find((entry) => entry.path === event.path);
  if (!file) {
    return;
  }

  file.status = event.status;
  file.progress = event.progress;

  if (event.status === "pending") {
    file.error = undefined;
  }

  if (event.totalCount !== undefined) {
    batchTotal = event.totalCount;
  }

  if (event.completedCount !== undefined) {
    batchCompleted = event.completedCount;
  }

  if (event.newPath) {
    file.path = event.newPath;
  }

  if (event.newName && event.newName !== file.name) {
    file.previousName = file.previousName ?? file.name;
    file.name = event.newName;
  }

  if (event.error) {
    file.error = translateBackendError(event.error);
  }

  renderFileList();
  updateProcessButton();
}

function fileProgressBarHtml(file: FileEntry): string {
  if (file.status !== "processing") {
    return "";
  }

  return `
    <div class="progress-bar progress-bar--file progress-bar--active">
      <div class="progress-bar__fill" style="width: ${file.progress}%"></div>
    </div>
  `;
}

function fileFailedLabel(failedIndex: number): string {
  const base = t("fileFailedLabel");
  if (failedIndex === 0) {
    return base;
  }

  return `${base} (${failedIndex})`;
}

function fileStatusBadgeHtml(file: FileEntry, failedIndex: number | undefined): string {
  if (file.status === "done") {
    return `<span class="file-item__status file-item__status--done">${t("fileDoneLabel")}</span>`;
  }

  if (file.status === "error" && failedIndex !== undefined) {
    return `<span class="file-item__status file-item__status--failed">${fileFailedLabel(failedIndex)}</span>`;
  }

  if (file.status === "pending") {
    return `<span class="file-item__status file-item__status--pending">${t("filePendingLabel")}</span>`;
  }

  return "";
}

function fileNameHtml(file: FileEntry): string {
  if (file.previousName && file.previousName !== file.name) {
    return `
      <span class="file-item__rename">
        <span class="file-item__name-old">${escapeHtml(file.previousName)}</span>
        <span class="file-item__rename-arrow" aria-hidden="true">→</span>
        <span class="file-item__name-new">${escapeHtml(file.name)}</span>
      </span>
    `;
  }

  return `<span class="file-item__name-current">${escapeHtml(file.name)}</span>`;
}

function renderFileList() {
  const hasFiles = files.length > 0;

  dropZoneContent.classList.toggle("hidden", hasFiles);
  filesView.classList.toggle("hidden", !hasFiles);
  dropZone.classList.toggle("drop-zone--filled", hasFiles);

  fileListEl.innerHTML = "";

  const failedIndexByFileId = new Map<string, number>();
  let failedCount = 0;
  files.forEach((file) => {
    if (file.status === "error") {
      failedIndexByFileId.set(file.id, failedCount);
      failedCount += 1;
    }
  });

  files.forEach((file) => {
    const item = document.createElement("li");
    item.className = "file-item";
    item.dataset.fileId = file.id;
    item.draggable = !isProcessing;

    item.innerHTML = `
      <div class="file-item__info">
        <p class="file-item__name" title="${escapeHtml(file.path)}">
          <span class="file-item__name-text">${fileNameHtml(file)}</span>
          ${fileStatusBadgeHtml(file, failedIndexByFileId.get(file.id))}
        </p>
        ${fileProgressBarHtml(file)}
      </div>
      <button class="file-item__remove" type="button" aria-label="${t("removeFileAria")}" ${isProcessing ? "disabled" : ""}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    `;

    item.querySelector(".file-item__remove")?.addEventListener("click", () => {
      removeFile(file.id);
    });

    item.addEventListener("dragstart", (event) => {
      if (isProcessing) {
        event.preventDefault();
        return;
      }

      draggedFileId = file.id;
      item.classList.add("file-item--dragging");
      event.dataTransfer?.setData("text/plain", file.id);
      event.dataTransfer!.effectAllowed = "move";
    });

    item.addEventListener("dragend", () => {
      draggedFileId = null;
      item.classList.remove("file-item--dragging");
      fileListEl.querySelectorAll(".file-item--drag-over").forEach((el) => {
        el.classList.remove("file-item--drag-over");
      });
    });

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (draggedFileId && draggedFileId !== file.id) {
        item.classList.add("file-item--drag-over");
      }
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("file-item--drag-over");
    });

    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("file-item--drag-over");

      if (!draggedFileId || draggedFileId === file.id) {
        return;
      }

      reorderFile(draggedFileId, file.id);
    });

    fileListEl.appendChild(item);
  });

  updateProcessButton();
}

function reorderFile(sourceId: string, targetId: string) {
  const sourceIndex = files.findIndex((file) => file.id === sourceId);
  const targetIndex = files.findIndex((file) => file.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return;
  }

  const [movedFile] = files.splice(sourceIndex, 1);
  files.splice(targetIndex, 0, movedFile);
  renderFileList();
}

function removeFile(fileId: string) {
  if (isProcessing) {
    return;
  }

  files = files.filter((file) => file.id !== fileId);
  renderFileList();
}

function clearAllFiles() {
  if (isProcessing) {
    return;
  }

  files = [];
  renderFileList();
}

async function addFilesFromPaths(paths: string[]) {
  const pdfPaths = paths.filter((path) => path.toLowerCase().endsWith(".pdf"));
  if (pdfPaths.length === 0) {
    return;
  }

  const existingPaths = new Set(files.map((file) => file.path));
  const newPaths = pdfPaths.filter((path) => !existingPaths.has(path));
  if (newPaths.length === 0) {
    return;
  }

  const fileInfos = await invoke<FileInfo[]>("get_files_info", { paths: newPaths });

  const newEntries: FileEntry[] = fileInfos.map((info) => ({
    id: crypto.randomUUID(),
    path: info.path,
    name: info.name,
    size: info.size,
    status: "pending",
    progress: 0,
  }));

  files = [...files, ...newEntries];
  renderFileList();
}

async function selectFiles() {
  if (isProcessing) {
    return;
  }

  const selected = await open({
    multiple: true,
    filters: [{ name: t("pdfFilter"), extensions: ["pdf"] }],
  });

  if (!selected) {
    return;
  }

  const paths = Array.isArray(selected) ? selected : [selected];
  await addFilesFromPaths(paths);
}

async function cancelProcessing() {
  if (!isProcessing) {
    return;
  }

  cancelProcessButton.disabled = true;
  applyCancelledState();
  void invoke("cancel_processing");
}

async function processFiles() {
  const pendingFiles = files.filter((file) => file.status === "pending");
  if (pendingFiles.length === 0) {
    return;
  }

  isProcessing = true;
  batchTotal = pendingFiles.length;
  batchCompleted = 0;
  pendingFiles.forEach((file) => {
    file.progress = 0;
  });
  updateProcessButton();

  try {
    await invoke("process_invoices", {
      paths: pendingFiles.map((file) => file.path),
      locale: getLocale(),
    });
  } catch (error) {
    const message = translateBackendError(
      error instanceof Error ? error.message : String(error),
    );
    pendingFiles.forEach((file) => {
      file.status = "error";
      file.error = message;
    });
    renderFileList();
  } finally {
    isProcessing = false;
    batchTotal = 0;
    batchCompleted = 0;
    updateProcessButton();
  }
}

function setDropZoneActive(active: boolean) {
  if (isProcessing) {
    return;
  }

  const hasFiles = files.length > 0;
  const targetZone = hasFiles ? addMoreZone : uploadZone;

  targetZone.classList.toggle("drop-panel--active", active);
}

function applyStaticTranslations(): void {
  applyDocumentLocale();
  clearAllButton.textContent = t("clearAll");
  selectButton.textContent = t("selectPdfFiles");
  addMoreButton.textContent = t("addMoreFiles");
  document.querySelector<HTMLElement>("#themeLabelText")!.textContent = t("themeLabel");
  updateThemeDropdown();
  settingsButton.setAttribute("aria-label", t("openSettingsAria"));
  settingsTooltipLabel.textContent = t("settingsTitle");
  document.querySelector<HTMLElement>("#settingsTitle")!.textContent = t("settingsTitle");
  document.querySelector<HTMLElement>("#promptLabelText")!.textContent = t("promptLabel");
  promptSavedStatus.textContent = t("promptSaveSaved");
  document.querySelector<HTMLElement>("#apiKeyLabelText")!.textContent = t("apiKeyLabel");
  apiKeyInput.placeholder = t("apiKeyPlaceholderMissing");
  saveApiKeyButton.textContent = t("saveApiKey");
  replaceApiKeyButton.textContent = t("replaceApiKey");
  cancelApiKeyButton.textContent = t("cancelApiKeyEdit");
  clearApiKeyButton.textContent = t("clearApiKey");
  cancelProcessButton.textContent = t("cancelProcessing");
  cancelProcessButton.setAttribute("aria-label", t("cancelProcessingAria"));
  closeSettingsButton.setAttribute("aria-label", t("closeSettingsAria"));
  document.querySelector<HTMLElement>(".drop-panel__hint")!.textContent = t("dropHint");
}

window.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  await initLocale();
  applyStaticTranslations();
  await listen<ProcessProgressEvent>("process-progress", (event) => {
    applyProgressUpdate(event.payload);
  });

  await listen("process-cancelled", () => {
    applyCancelledState();
  });

  selectButton.addEventListener("click", () => {
    void selectFiles();
  });

  addMoreButton.addEventListener("click", () => {
    void selectFiles();
  });

  clearAllButton.addEventListener("click", () => {
    clearAllFiles();
  });

  processButton.addEventListener("click", () => {
    void processFiles();
  });

  cancelProcessButton.addEventListener("click", () => {
    void cancelProcessing();
  });

  themeDropdownTrigger.addEventListener("click", () => {
    toggleThemeDropdown();
  });

  themeOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const theme = option.dataset.theme as ThemeMode | undefined;
      if (!theme) {
        return;
      }

      setTheme(theme);
      updateThemeDropdown();
      closeThemeDropdown();
    });
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node) || themeDropdown.contains(event.target)) {
      return;
    }

    closeThemeDropdown();
  });

  settingsButton.addEventListener("click", () => {
    void openSettings();
  });

  closeSettingsButton.addEventListener("click", () => {
    void requestCloseSettings();
  });

  settingsBackdrop.addEventListener("click", () => {
    void requestCloseSettings();
  });

  promptInput.addEventListener("input", () => {
    handlePromptInput();
  });

  promptInput.addEventListener("blur", () => {
    void savePromptIfNeeded();
  });

  saveApiKeyButton.addEventListener("click", () => {
    void saveApiKey();
  });

  replaceApiKeyButton.addEventListener("click", () => {
    startReplaceApiKey();
  });

  cancelApiKeyButton.addEventListener("click", () => {
    cancelApiKeyEdit();
  });

  apiKeyInput.addEventListener("input", () => {
    updateApiKeyUi();
  });

  clearApiKeyButton.addEventListener("click", () => {
    void clearApiKey();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!themeDropdownMenu.classList.contains("hidden")) {
      closeThemeDropdown();
      return;
    }

    if (!settingsModal.classList.contains("hidden")) {
      void requestCloseSettings();
    }
  });

  const appWindow = getCurrentWindow();
  await appWindow.onDragDropEvent((event) => {
    if (event.payload.type === "over") {
      setDropZoneActive(true);
      return;
    }

    if (event.payload.type === "leave") {
      setDropZoneActive(false);
      return;
    }

    if (event.payload.type === "drop") {
      setDropZoneActive(false);
      void addFilesFromPaths(event.payload.paths);
    }
  });

  renderFileList();
});

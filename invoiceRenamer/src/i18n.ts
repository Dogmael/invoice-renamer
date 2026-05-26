import { invoke } from "@tauri-apps/api/core";

export type Locale = "en" | "fr";

type MessageKey =
  | "app.title"
  | "clearAll"
  | "selectPdfFiles"
  | "dropHint"
  | "addMoreFiles"
  | "processOneFile"
  | "processManyFiles"
  | "processingProgress"
  | "settingsTitle"
  | "openSettingsAria"
  | "closeSettingsAria"
  | "promptLabel"
  | "savePrompt"
  | "cancelPromptEdit"
  | "unsavedSettingsWarning"
  | "apiKeyLabel"
  | "apiKeyPlaceholderMissing"
  | "saveApiKey"
  | "saveApiKeyValidating"
  | "replaceApiKey"
  | "cancelApiKeyEdit"
  | "clearApiKey"
  | "unsavedApiKeyWarning"
  | "discardChanges"
  | "keepEditing"
  | "removeFileAria"
  | "fileDoneLabel"
  | "filePendingLabel"
  | "fileFailedLabel"
  | "cancelProcessing"
  | "cancelProcessingAria"
  | "status.pending"
  | "status.processing"
  | "status.done"
  | "status.error"
  | "pdfFilter"
  | "error.mistralApiKeyMissing"
  | "error.mistralApiKeyInvalid"
  | "error.mistralApiKeyValidation"
  | "error.mistralChatNoFilename"
  | "error.invoiceInfoIncomplete"
  | "error.mistralApi"
  | "error.promptNotFound"
  | "error.pdfNoPages"
  | "error.noParentFolder"
  | "error.renameFailed"
  | "error.emptyFilename"
  | "error.fileNotFound"
  | "error.invalidFileName"
  | "error.secureStorageNotFound"
  | "error.secureStorage"
  | "error.promptSaveFailed"
  | "error.configUnavailable";

const messages: Record<Locale, Record<MessageKey, string>> = {
  en: {
    "app.title": "InvoiceRenamer",
    clearAll: "Clear all",
    selectPdfFiles: "Select PDF files",
    dropHint: "or drag and drop files here",
    addMoreFiles: "Add more files",
    processOneFile: "Process 1 file",
    processManyFiles: "Process {count} files",
    processingProgress: "Processing {current} of {total} \u00b7 {percent}%",
    settingsTitle: "Settings",
    openSettingsAria: "Open settings",
    closeSettingsAria: "Close settings",
    promptLabel: "Prompt",
    savePrompt: "Save prompt",
    cancelPromptEdit: "Cancel",
    unsavedSettingsWarning: "You have unsaved changes. Discard them?",
    apiKeyLabel: "Mistral API key",
    apiKeyPlaceholderMissing: "Paste your API key",
    saveApiKey: "Save key",
    saveApiKeyValidating: "Checking key…",
    replaceApiKey: "Replace key",
    cancelApiKeyEdit: "Cancel",
    clearApiKey: "Delete key",
    unsavedApiKeyWarning: "You have an unsaved API key. Discard your changes?",
    discardChanges: "Discard",
    keepEditing: "Keep editing",
    removeFileAria: "Remove file",
    fileDoneLabel: "Done",
    filePendingLabel: "Pending",
    fileFailedLabel: "Failed",
    cancelProcessing: "Cancel",
    cancelProcessingAria: "Cancel processing",
    "status.pending": "Pending",
    "status.processing": "Processing",
    "status.done": "Done",
    "status.error": "Error",
    pdfFilter: "PDF",
    "error.mistralApiKeyMissing":
      "Mistral API key is missing. Add it in Settings.",
    "error.mistralApiKeyInvalid":
      "This Mistral API key is invalid or unauthorized.",
    "error.mistralApiKeyValidation":
      "Could not verify the API key: {details}",
    "error.mistralChatNoFilename":
      "Mistral chat response did not contain a filename.",
    "error.invoiceInfoIncomplete":
      "Could not extract all required invoice information.",
    "error.mistralApi": "Mistral API error ({status}): {message}",
    "error.promptNotFound":
      "Prompt is empty. Add one in Settings.",
    "error.pdfNoPages": "PDF has no pages.",
    "error.noParentFolder": "Could not determine parent folder.",
    "error.renameFailed":
      "Could not rename {from} to {to}: {details}",
    "error.emptyFilename": "Generated filename is empty.",
    "error.fileNotFound": "File not found: {path}",
    "error.invalidFileName": "Invalid file name for path: {path}",
    "error.secureStorageNotFound": "No API key found in secure storage.",
    "error.secureStorage": "Secure storage error: {details}",
    "error.promptSaveFailed": "Could not save prompt: {details}",
    "error.configUnavailable": "Could not access app configuration: {details}",
  },
  fr: {
    "app.title": "InvoiceRenamer",
    clearAll: "Tout effacer",
    selectPdfFiles: "S\u00e9lectionner des PDF",
    dropHint: "ou glissez-d\u00e9posez vos fichiers ici",
    addMoreFiles: "Ajouter des fichiers",
    processOneFile: "Traiter 1 fichier",
    processManyFiles: "Traiter {count} fichiers",
    processingProgress: "Traitement {current} sur {total} \u00b7 {percent}%",
    settingsTitle: "Param\u00e8tres",
    openSettingsAria: "Ouvrir les param\u00e8tres",
    closeSettingsAria: "Fermer les param\u00e8tres",
    promptLabel: "Prompt",
    savePrompt: "Enregistrer le prompt",
    cancelPromptEdit: "Annuler",
    unsavedSettingsWarning: "Des modifications ne sont pas enregistr\u00e9es. Les abandonner ?",
    apiKeyLabel: "Cl\u00e9 API Mistral",
    apiKeyPlaceholderMissing: "Collez votre cl\u00e9 API",
    saveApiKey: "Enregistrer la cl\u00e9",
    saveApiKeyValidating: "V\u00e9rification…",
    replaceApiKey: "Remplacer la cl\u00e9",
    cancelApiKeyEdit: "Annuler",
    clearApiKey: "Supprimer la cl\u00e9",
    unsavedApiKeyWarning: "La cl\u00e9 API n'est pas enregistr\u00e9e. Abandonner vos modifications ?",
    discardChanges: "Abandonner",
    keepEditing: "Continuer la saisie",
    removeFileAria: "Retirer le fichier",
    fileDoneLabel: "Termin\u00e9",
    filePendingLabel: "En attente",
    fileFailedLabel: "\u00c9chou\u00e9",
    cancelProcessing: "Annuler",
    cancelProcessingAria: "Annuler le traitement",
    "status.pending": "En attente",
    "status.processing": "En cours",
    "status.done": "Termin\u00e9",
    "status.error": "Erreur",
    pdfFilter: "PDF",
    "error.mistralApiKeyMissing":
      "La cl\u00e9 API Mistral est manquante. Ajoutez-la dans les Param\u00e8tres.",
    "error.mistralApiKeyInvalid":
      "Cette cl\u00e9 API Mistral est invalide ou non autoris\u00e9e.",
    "error.mistralApiKeyValidation":
      "Impossible de v\u00e9rifier la cl\u00e9 API : {details}",
    "error.mistralChatNoFilename":
      "La r\u00e9ponse Mistral ne contient pas de nom de fichier.",
    "error.invoiceInfoIncomplete":
      "Impossible d'extraire toutes les informations requises de la facture.",
    "error.mistralApi": "Erreur API Mistral ({status}) : {message}",
    "error.promptNotFound":
      "Le prompt est vide. Ajoutez-en un dans les Param\u00e8tres.",
    "error.pdfNoPages": "Le PDF ne contient aucune page.",
    "error.noParentFolder": "Impossible de d\u00e9terminer le dossier parent.",
    "error.renameFailed":
      "Impossible de renommer {from} en {to} : {details}",
    "error.emptyFilename": "Le nom de fichier g\u00e9n\u00e9r\u00e9 est vide.",
    "error.fileNotFound": "Fichier introuvable : {path}",
    "error.invalidFileName": "Nom de fichier invalide pour le chemin : {path}",
    "error.secureStorageNotFound": "Aucune cl\u00e9 API trouv\u00e9e dans le stockage s\u00e9curis\u00e9.",
    "error.secureStorage": "Erreur de stockage s\u00e9curis\u00e9 : {details}",
    "error.promptSaveFailed": "Impossible d'enregistrer le prompt : {details}",
    "error.configUnavailable": "Impossible d'acc\u00e9der \u00e0 la configuration : {details}",
  },
};

type FileStatus = "pending" | "processing" | "done" | "error";

const statusKeys: Record<FileStatus, MessageKey> = {
  pending: "status.pending",
  processing: "status.processing",
  done: "status.done",
  error: "status.error",
};

let cachedLocale: Locale | null = null;

function localeFromLanguageTag(language: string): Locale {
  return language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

function localeFromNavigator(): Locale {
  const candidates = [navigator.language, ...(navigator.languages ?? [])];

  for (const language of candidates) {
    if (language.toLowerCase().startsWith("fr")) {
      return "fr";
    }
  }

  return "en";
}

export async function initLocale(): Promise<void> {
  try {
    const systemLocale = await invoke<string>("get_system_locale");
    cachedLocale = localeFromLanguageTag(systemLocale);
  } catch {
    cachedLocale = localeFromNavigator();
  }
}

export function getLocale(): Locale {
  return cachedLocale ?? localeFromNavigator();
}

export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const locale = getLocale();
  let text = messages[locale][key] ?? messages.en[key] ?? key;

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }

  return text;
}

export function statusText(status: FileStatus): string {
  return t(statusKeys[status]);
}

const backendErrorKeys: Record<string, MessageKey> = {
  "error.mistral_api_key_missing": "error.mistralApiKeyMissing",
  "error.mistral_api_key_invalid": "error.mistralApiKeyInvalid",
  "error.mistral_chat_no_filename": "error.mistralChatNoFilename",
  "error.invoice_info_incomplete": "error.invoiceInfoIncomplete",
  "error.prompt_not_found": "error.promptNotFound",
  "error.pdf_no_pages": "error.pdfNoPages",
  "error.no_parent_folder": "error.noParentFolder",
  "error.empty_filename": "error.emptyFilename",
  "error.secure_storage_not_found": "error.secureStorageNotFound",
};

export function translateBackendError(message: string): string {
  if (message.startsWith("error.mistral_api|")) {
    const parts = Object.fromEntries(
      message
        .slice("error.mistral_api|".length)
        .split("|")
        .map((part) => part.split("=", 2) as [string, string]),
    );
    return t("error.mistralApi", {
      status: parts.status ?? "?",
      message: parts.message ?? message,
    });
  }

  if (message.startsWith("error.rename_failed|")) {
    const parts = Object.fromEntries(
      message
        .slice("error.rename_failed|".length)
        .split("|")
        .map((part) => part.split("=", 2) as [string, string]),
    );
    return t("error.renameFailed", {
      from: parts.from ?? "?",
      to: parts.to ?? "?",
      details: parts.details ?? message,
    });
  }

  if (message.startsWith("error.file_not_found|")) {
    return t("error.fileNotFound", {
      path: message.slice("error.file_not_found|".length),
    });
  }

  if (message.startsWith("error.invalid_file_name|")) {
    return t("error.invalidFileName", {
      path: message.slice("error.invalid_file_name|".length),
    });
  }

  if (message.startsWith("error.secure_storage|")) {
    const details = message.slice("error.secure_storage|".length);
    const normalizedDetails = details.startsWith("details=")
      ? details.slice("details=".length)
      : details;
    return t("error.secureStorage", { details: normalizedDetails });
  }

  if (message.startsWith("error.prompt_save_failed|")) {
    const details = message.slice("error.prompt_save_failed|".length);
    const normalizedDetails = details.startsWith("details=")
      ? details.slice("details=".length)
      : details;
    return t("error.promptSaveFailed", { details: normalizedDetails });
  }

  if (message.startsWith("error.mistral_api_key_validation|")) {
    const details = message.slice("error.mistral_api_key_validation|".length);
    const normalizedDetails = details.startsWith("details=")
      ? details.slice("details=".length)
      : details;
    return t("error.mistralApiKeyValidation", { details: normalizedDetails });
  }

  if (message.startsWith("error.config_unavailable|")) {
    const details = message.slice("error.config_unavailable|".length);
    const normalizedDetails = details.startsWith("details=")
      ? details.slice("details=".length)
      : details;
    return t("error.configUnavailable", { details: normalizedDetails });
  }

  const mappedKey = backendErrorKeys[message];
  if (mappedKey) {
    return t(mappedKey);
  }

  const lowerMessage = message.toLowerCase();
  if (
    lowerMessage.includes("no matching entry found in secure storage")
    || lowerMessage.includes("no matching entry")
  ) {
    return t("error.secureStorageNotFound");
  }

  return message;
}

export function applyDocumentLocale(): void {
  document.documentElement.lang = getLocale();
  document.title = t("app.title");
}

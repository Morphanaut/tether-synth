
// ============================================================================
// UI STATE CLASSES
// ============================================================================

/**
 * CSS class for active/engaged toggle buttons
 */
export const BTN_ACTIVE = "_s-active";

/**
 * CSS class for inactive/disengaged toggle buttons
 */
export const BTN_INACTIVE = "_s-inactive";

/**
 * Typography class mappings from Design System
 */
export const TYPO = {
    SUB_SECTION: "_t-sub-sect",
    PANEL_TITLE: "_t-panel-title",
    PANEL_DESC: "_t-panel-desc",
    LABEL: "_t-label",
    VALUE: "_t-value",
} as const;

/**
 * Modal component class mappings
 */
export const MODAL = {
    LAYOUT: {
        OVERLAY: "_c-overlay",
        PANEL: "_b-panel border shadow-2xl relative flex flex-col",
        HEADER: "_b-widget border-b flex flex-shrink-0 justify-between items-baseline p-6",
        BODY: "flex-grow overflow-y-auto p-6",
        FOOTER: "_b-widget border-t flex flex-shrink-0 p-6 bg-zinc-900/20"
    },
    TYPO: {
        TITLE: "_t-modal-title",
        SUB_TITLE: "_t-modal-sub-title",
        BODY: "_t-modal-body",
        META: "_t-meta opacity-50",
        DT: "_t-definition-term",
        FOOTNOTE: "_t-modal-footnote"
    }
} as const;

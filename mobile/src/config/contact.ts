/**
 * How customers reach BinMan.
 *
 * One place, because these strings were previously scattered across the support
 * screen, both legal documents, the marketing site and the WhatsApp bot — each
 * with a different invented value ("0700-BINMAN", "+2347002466266",
 * "support@binman.ng"), none of which anyone answers. A contact detail that is
 * wrong in one of five places is worse than one that is missing.
 */

/** E.164, for `tel:` links and anything the server sends. */
export const SUPPORT_PHONE = '+2349038912979';

/** As a Nigerian customer would read it back. */
export const SUPPORT_PHONE_DISPLAY = '0903 891 2979';

/** wa.me wants the number without a leading + or zero. */
export const SUPPORT_WHATSAPP = '2349038912979';

export const SUPPORT_EMAIL = 'info.binman@gmail.com';

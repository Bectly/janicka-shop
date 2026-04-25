export const FROM_ORDERS =
  process.env.EMAIL_FROM_ORDERS?.trim() ?? "Janička <objednavky@jvsatnik.cz>";
export const FROM_INFO =
  process.env.EMAIL_FROM_INFO?.trim() ?? "Janička <info@jvsatnik.cz>";
export const FROM_NEWSLETTER =
  process.env.EMAIL_FROM_NEWSLETTER?.trim() ?? "Janička <novinky@jvsatnik.cz>";
export const FROM_SUPPORT =
  process.env.EMAIL_FROM_SUPPORT?.trim() ?? "Janička <podpora@jvsatnik.cz>";
export const REPLY_TO =
  process.env.EMAIL_REPLY_TO?.trim() ?? "podpora@jvsatnik.cz";

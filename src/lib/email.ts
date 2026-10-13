import { Resend } from "resend";
import { config } from "../config.js";

export type EnquiryEmail = {
  fullName: string;
  phone: string;
  travelDate: string;
  destination: string;
  budget: string;
  travelers: number;
  notes: string;
};

let client: Resend | undefined;

// Header values must stay on one line
const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ");

/**
 * Emails a website enquiry to the team. The recipient comes only from the
 * server's environment, never from the request. Throws if email isn't
 * configured or Resend rejects the message.
 */
export async function sendEnquiryEmail(enquiry: EnquiryEmail): Promise<void> {
  const { apiKey, to, from } = config.enquiryEmail;
  if (!apiKey || !to || !from) {
    throw new Error("Enquiry email is not configured (RESEND_API_KEY, ENQUIRY_TO_EMAIL, ENQUIRY_FROM_EMAIL)");
  }
  client ??= new Resend(apiKey);

  const { error } = await client.emails.send({
    from,
    to,
    subject: oneLine(`New enquiry: ${enquiry.fullName} – ${enquiry.destination}`),
    text: [
      "New enquiry from the Purple World Tours website",
      "",
      `Name:         ${enquiry.fullName}`,
      `Phone:        ${enquiry.phone}`,
      `Travel date:  ${enquiry.travelDate}`,
      `Destination:  ${enquiry.destination}`,
      `Budget:       ${enquiry.budget}`,
      `Travellers:   ${enquiry.travelers}`,
      "",
      "Notes:",
      enquiry.notes || "(none)",
      "",
      "This enquiry is also listed under Enquiries in the admin panel.",
    ].join("\n"),
  });
  // Resend reports API and network failures in `error` rather than throwing.
  // Only the code and message are logged, never the request headers or key.
  if (error) throw new Error(`Resend failed to send enquiry email: ${error.name}: ${error.message}`);
}

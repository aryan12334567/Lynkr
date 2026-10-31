import type { Metadata } from "next";
import { ContactEmail, LegalPage, Section } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metaMetadata = { title: "Privacy Policy | Lynkr", description: "What Lynkr does with your data, in plain words." };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Lynkr is operated by {SITE.operator}, an individual in {SITE.country}. This page explains what happens to the information you give Lynkr. We aim to handle personal data in line with applicable Indian law,
        including the Digital Personal Data Protection Act, 2023.
      </p>

      <Section title="Your account">
        <p>
          If you create an account, Lynkr stores your name, email address, whether your email is confirmed, a securely hashed password (never the password itself) or the Google, Apple or LinkedIn account you signed in
          with, any passkeys you add, your sign-in sessions (with the IP address and browser they came from) and the id of your Dodo Payments customer record. We email you only to confirm your address, reset your
          password, send a sign-in code, or send a &quot;continue on your laptop&quot; link you asked for (it works once and expires after 15 minutes).
        </p>
        <p>
          If you choose Sign in with LinkedIn, Lynkr asks LinkedIn only for your name, email address and profile photo (the &quot;openid&quot;, &quot;profile&quot; and &quot;email&quot; permissions). Lynkr cannot post,
          comment or send messages for you, and cannot see your connections, your feed or your full profile.
        </p>
        <p>
          With an account, your context is saved to it so it&apos;s the same on every device: your context brief (who you are, what you want, target roles and companies, must-haves, whether your job search is
          private, weekly time and tone), your Story Vault facts, your interview answers (unless you switch saving answers off), and your drafts and weekly plan. This is stored in Lynkr&apos;s database on Neon,
          hosted in AWS US East (N. Virginia, USA, region us-east-1). You can switch off saving your interview answers in the app; Lynkr then keeps only the context brief and the facts you confirm.
        </p>
      </Section>

      <Section title="How long we keep it, and how to get it or delete it">
        <p>
          Your saved context is kept until you delete it, and removed automatically after 12 months without any activity on your account. In the app, &quot;Download my data&quot; gives you everything Lynkr holds for
          your account as a JSON file, and &quot;Delete my data&quot; removes all of your saved context at once: brief, Story Vault, answers, drafts and plan. Your sign-in account itself stays, so you can
          start again; to delete the account too, write to us (see below).
        </p>
      </Section>

      <Section title="Your LinkedIn PDF">
        <p>
          If you import the PDF that LinkedIn&apos;s &quot;Save to PDF&quot; makes, it is read inside your browser. The file is never uploaded or stored. Only the details you confirm are kept, as part of your context.
        </p>
      </Section>

      <Section title="Without an account">
        <p>
          If you use a license key without an account, your Story Vault, drafts, weekly plan, tracker and settings stay in your browser&apos;s local storage on your own device, as before. Lynkr&apos;s servers do not keep a
          copy. &quot;Start over&quot; deletes them, and clearing your browser data does too. Your license key and this browser&apos;s activation id are kept in local storage as well.
        </p>
      </Section>

      <Section title="Using the Chrome Extension">
        <p>
          If you install the Lynkr Chrome Extension, it helps you insert Lynkr drafts into LinkedIn&apos;s message and comment boxes. The extension is a pair of things: the side panel that shows your contacts and drafts, and the
          &quot;Write with Lynkr&quot; right-click menu that receives selected text from any page (not just LinkedIn).
        </p>
        <p>
          What the extension <strong>does</strong>:
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            Reading <strong>selected text only</strong> through the &quot;Write with Lynkr&quot; menu. When you right-click on any page and choose Lynkr, Lynkr receives the text you selected—not the entire page.
          </li>
          <li>
            Reading <strong>the current tab&apos;s address only</strong> when you press &quot;Save this profile link&quot;. The extension never crawls or loads the page; it only sees what you tell it to fetch.
          </li>
          <li>
            Inserting a draft into the box you clicked or, if that fails, copying the draft to your clipboard. You paste it yourself.
          </li>
          <li>
            Storing at most 3 facts per contact, each with its source URL and date, plus your drafts and pairing token.
          </li>
          <li>
            Sending requests to Lynkr&apos;s servers (lynkr.cloud and its preview/local origins during development) to fetch contacts, drafts and process your selected text.
          </li>
        </ul>
        <p>
          What the extension <strong>never does</strong>:
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            No scraping or crawling of LinkedIn pages, Facebook, Instagram, X, Threads, Reddit, or any social network. It asks for no permission to access these sites.
          </li>
          <li>
            No sending of messages or connection requests. You send everything yourself, on LinkedIn. Lynkr only prepares the text.
          </li>
          <li>
            No clicking, menu actions, or automation of LinkedIn sites. Every insert requires you to click or press a key.
          </li>
          <li>
            No storing of raw page text or raw selected text. Text is used once for drafting, then discarded.
          </li>
        </ul>
        <p>
          Data the extension stores:
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            Your contacts (name, company, role, profile URL, relationship, goal, etc.)
          </li>
          <li>
            At most 3 facts per contact with their sources (public pages, selections you confirmed, notes)
          </li>
          <li>
            Your drafts (organized by contact and channel: connection note, first message, DM, InMail, email)
          </li>
          <li>
            Your pairing token (stored hashed in the browser)
          </li>
        </ul>
        <p>
          What the extension sends:
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            The selected text (once) for drafting, targeting the contact you chose
          </li>
          <li>
            Profile URLs you save to add them to your contacts
          </li>
          <li>
            Outcomes you mark to update contact stages
          </li>
          <li>
            The pairing token with every request to identify you
          </li>
        </ul>
        <p>
          Search limits: 20 searches per user per day, capped across users at 2000 per month (configurable). When the limit is reached, search pauses and Lynkr tells you.
        </p>
        <p>
          Retention and deletion: Contacts and briefs are kept while you&apos;re a Lynkr user. You can download and delete all your data at any time from the app. When you delete a contact, all its facts and drafts are also deleted. When you revoke the extension, the token stops, but your contacts remain in your account until you delete them. Contacts are removed after 12 months of inactivity.
        </p>
        <p>
          Chrome permissions: activeTab (to insert text, read the tab address when you ask), contextMenus (to receive &quot;Write with Lynkr&quot; selections), storage (to keep your pairing token), sidePanel (to open the panel), scripting (to run insert in the active tab). These are the only permissions the extension asks for.
        </p>
        <p>
          If you&apos;re ever unsure whether the extension is working correctly, you can revoke its token from My data and pair again. If the extension is removed by Chrome, the web app continues to work—you can still copy drafts and open profiles from the web app.
        </p>
      </Section>

      <Section title="What is sent to write your drafts">
        <p>
          When you answer interview questions, confirm facts, paste a post or a job description, or upload a screenshot for Connect Coach, that text or image is sent through Lynkr&apos;s server to an AI provider
          (currently OpenAI) so it can write the reply. With an account, your interview answers, the facts you confirm and your saved drafts are kept in your account as described above; everything else (pasted
          posts, job descriptions, screenshots and imported profile files) is used once and not saved. The AI provider handles that data under its own terms and privacy policy. Please don&apos;t enter passwords, government ID numbers, bank or card details, or other people&apos;s private information.
        </p>
      </Section>

      <Section title="Job-page import">
        <p>
          If you paste a link to a public job posting and ask Lynkr to import it, the link is sent to a scraping service (Apify) that reads that public page. Only the link is sent, and only when you use this option.
        </p>
      </Section>

      <Section title="Payments and license keys">
        <p>
          Payments are processed by Dodo Payments, the Merchant of Record. Dodo collects your payment details and email address under its own privacy policy, and Lynkr never sees your card details. When you enter a license
          key, Lynkr sends the key to Dodo to check that your subscription is active.
        </p>
      </Section>

      <Section title="Technical information">
        <p>
          Our hosting provider (Vercel) and our server record technical information such as IP address, time and the page or API requested. We use it for security, to limit abuse and to keep the service running. The
          text of your answers is never written to these logs. To see whether the interview works, Lynkr counts events such as interviews started and finished, time taken and the 1 to 5 rating you give the summary;
          these counts carry no name, email or answer text. Lynkr does not use advertising or analytics cookies, and does not sell personal data.
        </p>
      </Section>

      <Section title="Who handles data for Lynkr">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>OpenAI: writes drafts from what you submit.</li>
          <li>Dodo Payments: payments, tax, invoices and license keys.</li>
          <li>Vercel: hosting.</li>
          <li>Neon: the database that holds accounts and saved context (AWS US East).</li>
          <li>Resend: sends account emails, including the &quot;continue on your laptop&quot; link.</li>
          <li>Google: only if you choose &quot;Continue with Google&quot;.</li>
          <li>Apple: only if you choose &quot;Continue with Apple&quot;.</li>
          <li>LinkedIn: only if you choose Sign in with LinkedIn: your name, email and photo.</li>
          <li>Apify: reads a public job page, only if you use the import.</li>
        </ul>
      </Section>

      <Section title="Your choices and requests">
        <p>
          You can download or delete your saved work at any time in the app. To delete your account, or to ask about any personal data we hold, such as your account details or emails you send us, write to <ContactEmail />
          . Lynkr is for people aged 18 and over.
        </p>
      </Section>

      <Section title="Changes">&lt;p&gt;If this policy changes in a way that matters, the change will be visible on this page with a new date.&lt;/p&gt;</Section>
    </LegalPage>
  );
}
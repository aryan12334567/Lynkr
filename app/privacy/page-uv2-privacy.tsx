import type { Metadata } from "next";
import { ContactEmail, LegalPage, Section } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

/**
 * DRAFT privacy text for Outreach v2 (U11, requirements R33, R47). Not published: app/privacy/page.tsx renders
 * this only while outreachVersion() is "v2" (preview, or production once the owner turns it on). The v1 text
 * in page.tsx is unchanged.
 */
export const metadata: Metadata = { title: "Privacy Policy | Lynkr", description: "What Lynkr does with your data, in plain words." };

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
          private, weekly time and tone), your Story Vault facts, your interview answers (unless you switch saving answers off), your drafts and weekly plan, and the Outreach records described below. This is stored
          in Lynkr&apos;s database on Neon, hosted in AWS US East (N. Virginia, USA, region us-east-1). You can switch off saving your interview answers in the app; Lynkr then keeps only the context brief and the facts
          you confirm.
        </p>
      </Section>

      <Section title="Outreach: the people you write to">
        <p>
          Outreach helps you write to people on LinkedIn and keep track of each conversation. It is part of the paid plan. This section says exactly what it reads, stores and sends.
        </p>
        <p>
          <strong>What is read.</strong> Lynkr reads only what you give it:
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Text you type into Lynkr.</li>
          <li>
            Text you select on a page and send through the &quot;Write with Lynkr&quot; right-click menu. Lynkr receives the selected text only, not the page around it, and does not save the raw selection.
          </li>
          <li>
            The address of the current tab, only when you press &quot;Save this profile link&quot;. Lynkr then checks that it is a LinkedIn profile address and saves the address, nothing from the page.
          </li>
          <li>
            Your LinkedIn connections file, only if you choose to import it. It is read inside your browser. Only name, company, position, profile address and the date you connected are kept in the browser, and the
            email column is dropped when the file is read. Nothing from the file leaves your device until you add a person from it, and then only that one person is saved.
          </li>
          <li>
            Public web pages (outside LinkedIn and social networks) that you confirm are about the person. Lynkr fetches only the results you confirm.
          </li>
        </ul>
        <p>
          <strong>What is stored in your account.</strong>
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            Your contacts: name, company, role, profile address, how you know them, your goal for them and what the next message asks for.
          </li>
          <li>
            &quot;Why you connected&quot;: one line of up to 200 characters, filled from where you found the person or written by you.
          </li>
          <li>
            At most 3 facts per contact, each with its source link and date. They come only from public pages you confirmed, text you selected and confirmed, or what you typed. Details such as health, religion, caste,
            politics, family, finances or sexuality are never kept as facts, even when a page contains them.
          </li>
          <li>Your drafts, by contact and channel (connection note, first message, DM, InMail, email).</li>
          <li>
            The timeline of each contact: dated steps such as invite sent, accepted, message sent, reply received, meeting booked, meeting done, goal reached and close, and the next steps Lynkr suggests with their reasons.
            Lynkr records a step only when you record it. It does not read your LinkedIn messages, inbox or calendar.
          </li>
          <li>
            Optional meeting notes: one line of up to 280 characters per meeting, saved with its date, and shown only to you. Please skip health, money, family or ID details.
          </li>
          <li>
            Your goal and goal details (for example the kind of business you want to buy), and which Chrome extension you paired. The pairing token is stored hashed on Lynkr&apos;s side; the extension keeps the token
            itself in Chrome&apos;s local storage until you revoke it.
          </li>
        </ul>
        <p>
          <strong>What is sent, and to whom.</strong>
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            To OpenAI, to write a draft: your goal and goal details, the facts about you that you confirmed, up to 3 facts about the person with their sources, the &quot;why you connected&quot; line, the channel and
            length, and any text you selected for that draft. Meeting notes are not sent to the AI provider. OpenAI handles this data under its own terms and privacy policy.
          </li>
          <li>
            To Exa, when you search for public pages about a person: the words you search with (usually their name and company, up to 500 characters). Exa returns web pages from outside LinkedIn and social networks.
            Lynkr then asks Exa for the text of only the results you confirm, by their web address.
          </li>
          <li>To Lynkr&apos;s servers, from the Chrome extension: the token that identifies you, text you selected, profile addresses you save and the records you tap.</li>
        </ul>
        <p>
          <strong>What Lynkr never does.</strong>
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>It never reads LinkedIn pages or any page content, and never crawls or scrapes LinkedIn, Facebook, Instagram, X, Threads or Reddit.</li>
          <li>It never sends a message, comment or connection request for you, never clicks anything on a page and never runs on its own. You press insert or copy, and you send everything yourself on LinkedIn.</li>
          <li>It never reads your LinkedIn messages, your inbox or your calendar, and never sends a calendar invitation.</li>
          <li>It never asks for your LinkedIn password or cookies, and does not sell personal data.</li>
        </ul>
        <p>
          <strong>People you write to.</strong> Please enter only what you would be comfortable with the person seeing. Do not enter other people&apos;s private information such as health, money, family or ID details; a
          short, factual note about a meeting is fine. If you believe a Lynkr user has saved information about you and want it removed, write to us (see below).
        </p>
        <p>
          <strong>Calendar.</strong> A meeting or step you add to Google Calendar or download as an .ics file becomes a copy in your own calendar. Lynkr cannot remove it later; delete it there.
        </p>
        <p>
          <strong>Limits.</strong> To keep costs and abuse in check, each user can run 20 public-page searches a day, and searches stop for everyone at 2,000 a month. When a limit is reached, Lynkr tells you.
        </p>
      </Section>

      <Section title="How long we keep it, and how to get it or delete it">
        <p>
          Your saved context is kept until you delete it, and removed automatically after 12 months without any activity on your account. This covers your contacts, facts, drafts, timeline steps and meeting notes too.
          In the app, &quot;Download my data&quot; gives you everything Lynkr holds for your account as a JSON file, including your contacts, timelines and notes, and &quot;Delete my data&quot; removes all of your
          saved context at once: brief, Story Vault, answers, drafts, plan, contacts and their timelines. Deleting one contact removes its facts, drafts, timeline steps and notes. Your sign-in account itself stays, so
          you can start again; to delete the account too, write to us (see below).
        </p>
        <p>
          If your subscription ends, you can still read, download and delete your contacts, timelines and notes. Recording new steps and writing new drafts need an active subscription. Revoking the Chrome extension
          from My data stops its token at once; your contacts stay in your account until you delete them.
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
          copy. &quot;Start over&quot; deletes them, and clearing your browser data does too. Your license key and this browser&apos;s activation id are kept in local storage as well. Outreach needs an account.
        </p>
      </Section>

      <Section title="Using the Chrome extension">
        <p>
          The Lynkr Chrome extension shows your contacts and ready drafts in a side panel and helps you put a draft into the box you clicked on LinkedIn. It also adds a &quot;Write with Lynkr&quot; right-click menu that
          receives the text you selected, on any page. It works only when you have paired it from the web app and have an active subscription.
        </p>
        <p>The extension reads only two things:</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>the text you select, when you choose &quot;Write with Lynkr&quot;, and</li>
          <li>the address of the current tab, when you press &quot;Save this profile link&quot;.</li>
        </ul>
        <p>
          It does not read page content, click anything on a page or send anything. If inserting a draft fails, it copies the draft to your clipboard and tells you to paste it. It talks only to Lynkr&apos;s servers
          (lynkr.cloud), never to other sites. Everything it does can also be done in the web app by copying the draft and opening the profile.
        </p>
        <p>
          Chrome permissions: <code>activeTab</code> (to put a draft in the box you clicked and to read the tab address when you ask), <code>contextMenus</code> (the &quot;Write with Lynkr&quot; menu),{" "}
          <code>storage</code> (to keep your pairing token), <code>sidePanel</code> (to open the panel), <code>scripting</code> (to run the insert in the active tab) and access to lynkr.cloud (to reach Lynkr). It asks
          for no access to linkedin.com pages.
        </p>
      </Section>

      <Section title="What is sent to write your drafts">
        <p>
          When you answer interview questions, confirm facts, paste a post or a job description, upload a screenshot for Connect Coach, or ask for an Outreach draft, that text or image, and the Outreach details listed
          above, are sent through Lynkr&apos;s server to an AI provider (currently OpenAI) so it can write the reply. With an account, your interview answers, the facts you confirm, your saved drafts and your Outreach
          records are kept in your account as described above; everything else (pasted posts, job descriptions, screenshots, selected text and imported profile files) is used once and not saved. The AI provider
          handles that data under its own terms and privacy policy. Please don&apos;t enter passwords, government ID numbers, bank or card details. Do not enter other people&apos;s private information, such as their
          health, money, family or ID details; a short, factual note about a meeting is fine.
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
          key, Lynkr sends the key to Dodo to check that your subscription is active. The extension and the Outreach pages check the same thing on each request.
        </p>
      </Section>

      <Section title="Technical information">
        <p>
          Our hosting provider (Vercel) and our server record technical information such as IP address, time and the page or API requested. We use it for security, to limit abuse and to keep the service running. The
          text of your answers, drafts, selections and notes is never written to these logs. To see whether the interview and Outreach work, Lynkr counts events such as interviews started and finished, time taken and
          the 1 to 5 rating you give the summary; these counts carry no name, email or answer text. Lynkr does not use advertising or analytics cookies, and does not sell personal data.
        </p>
      </Section>

      <Section title="Who handles data for Lynkr">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>OpenAI: writes drafts from what you submit.</li>
          <li>Exa: finds public web pages about a person, from the words you search with.</li>
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
          You can download or delete your saved work at any time in the app. To delete your account, to ask about any personal data we hold, such as your account details or emails you send us, or to ask us to remove
          information a user has saved about you, write to <ContactEmail />. Lynkr is for people aged 18 and over.
        </p>
      </Section>

      <Section title="Changes">
        <p>If this policy changes in a way that matters, the change will be visible on this page with a new date.</p>
      </Section>
    </LegalPage>
  );
}

export const SUPPORT_EMAIL = "support@vismuse.com";
export const SUPPORT_EMAIL_HREF = `mailto:${SUPPORT_EMAIL}`;
export const PAYMENT_SUMMARY = "Payments are processed by Stripe. Available payment methods and the final total are shown at Stripe checkout before you pay. Vismuse does not store full card numbers.";
export const CANCELLATION_SUMMARY = "Subscriptions renew automatically unless cancelled. Your selected plan determines monthly or annual billing. Cancel future renewals anytime and keep paid access until the current billing period ends.";
export const REFUND_ELIGIBILITY_SUMMARY = "You may request a refund within 7 calendar days of a charge if you have made no downloads after that charge and completed no more than 5 paid generations.";
export const BILLING_SUPPORT_RESPONSE_SUMMARY = "For billing, cancellation, refund, and dispute questions, we aim to respond within three business days.";

type HelpArticle = {
  question: string;
  paragraphs: readonly string[];
  steps?: readonly string[];
  links?: readonly { href: string; label: string }[];
};
type HelpTopic = {
  id: string;
  title: string;
  description: string;
  articles: readonly HelpArticle[];
};

export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    id: "payments",
    title: "Payments & billing",
    description: "Checkout, receipts, and purchases that have not appeared in your account.",
    articles: [
      {
        question: "How are payments handled?",
        paragraphs: [PAYMENT_SUMMARY, "Use Stripe checkout to confirm the currency, billing interval, and total before completing a purchase."],
        links: [{ href: "/privacy", label: "Payment data in our Privacy Policy" }]
      },
      {
        question: "I paid, but my plan or credits have not updated. What should I do?",
        paragraphs: ["Payment confirmation and account updates may not arrive at the same time. Do not make another purchase to fix a missing plan or credit balance."],
        steps: [
          "Sign in with the same account email you used for the purchase, then return to Vismuse from checkout and refresh the page.",
          "Check your receipt or invoice for the payment status and order reference.",
          "If the purchase is still missing, email support with your account email, order or invoice reference, charge date, amount, and currency. Attach a screenshot of the error if available."
        ]
      }
    ]
  },
  {
    id: "subscriptions",
    title: "Subscriptions & cancellation",
    description: "Automatic renewals, billing intervals, and stopping future charges.",
    articles: [
      {
        question: "Will my subscription renew automatically?",
        paragraphs: [CANCELLATION_SUMMARY, "A monthly equivalent displayed for an annual plan is not a monthly charge: check the yearly billed total before paying. One-time credit purchases are not subscriptions."],
        links: [{ href: "/pricing", label: "Compare plans and billing intervals" }]
      },
      {
        question: "How do I cancel my subscription?",
        paragraphs: ["Cancellation stops future renewal; it does not automatically refund your current billing period or unused credits."],
        steps: [
          "Sign in to the account that owns the subscription and open the account menu in your workspace.",
          "Choose Manage Subscription and complete cancellation in the billing controls shown for your payment provider.",
          "Check for cancellation confirmation. If the controls are missing or fail, email support from your account email with your order or invoice reference."
        ],
        links: [{ href: "/refund-policy", label: "Cancellation and access policy" }]
      }
    ]
  },
  {
    id: "refunds",
    title: "Refunds",
    description: "Eligibility, exceptions, and how to request a review.",
    articles: [
      {
        question: "When can I request a refund?",
        paragraphs: [REFUND_ELIGIBILITY_SUMMARY, "Any download after the applicable subscription charge or more than 5 paid generations counts as material use. After material use, subscriptions, one-time purchases, paid unlocks, and credit purchases are generally non-refundable. Verified billing errors, duplicate charges, and confirmed technical issues are reviewed case by case. The full Refund Policy contains exclusions and applicable-law exceptions."],
        links: [{ href: "/refund-policy", label: "Read the full Refund Policy" }]
      },
      {
        question: "How do I request a refund or report a duplicate charge?",
        paragraphs: ["Email support from the address associated with your account. Include your account email, order or invoice reference, charge date, reason for the request, and any relevant error or output examples.", BILLING_SUPPORT_RESPONSE_SUMMARY, "Approved refunds are returned to the original payment method within five business days, subject to additional processing time from the payment provider or financial institution."],
        links: [{ href: SUPPORT_EMAIL_HREF, label: "Email billing support" }]
      }
    ]
  },
  {
    id: "credits",
    title: "Credits & usage",
    description: "Understanding your balance and reporting unexpected deductions.",
    articles: [
      {
        question: "Why do different generations use different amounts of credits?",
        paragraphs: ["Credits give you access to generation features; they are not money and cannot be transferred or redeemed for cash. Credit usage depends on the feature and its settings. Image count, resolution, quality, revisions, and video settings can affect the cost. Check the cost or credit notice shown in your workflow before submitting."],
        links: [{ href: "/pricing", label: "Plan allowances" }, { href: "/terms", label: "Credit terms" }]
      },
      {
        question: "My credit balance looks wrong. What information should I send?",
        paragraphs: ["Make sure you are signed in to the correct account and refresh the balance. If it still looks wrong, email your account email, the approximate time and timezone, the feature used, the job or session reference if available, and screenshots of the before-and-after balance. Do not repeatedly submit the same task while investigating a deduction."]
      }
    ]
  },
  {
    id: "generation",
    title: "Failed or stuck generations",
    description: "Finding the task status and getting a credit or technical issue reviewed.",
    articles: [
      {
        question: "My generation failed or seems stuck. What should I do?",
        paragraphs: ["Check the task status in the original workspace before starting a replacement. Refresh once if the page stopped updating. Repeated submissions can create additional tasks and credit charges.", "If the issue continues, send support your account email, the feature, task time and timezone, the job or session reference if available, and the exact error message. Include a screenshot and only the example files needed to explain the problem."]
      },
      {
        question: "Does a failed generation automatically mean a cash refund?",
        paragraphs: ["No. Where the product explicitly states that credits are automatically restored for a failed generation, that is a credit adjustment, not a cash refund. Check the task status and balance. If the promised adjustment is missing, contact support with the task details. Confirmed technical issues may be reviewed for credit restoration or a refund under the Refund Policy."],
        links: [{ href: "/refund-policy", label: "Failed-generation and technical-issue policy" }]
      }
    ]
  },
  {
    id: "downloads",
    title: "Downloads & exports",
    description: "Missing files, blocked downloads, and export quality.",
    articles: [
      {
        question: "My download does not start or the file is missing. What should I check?",
        paragraphs: ["Confirm the generation has completed and use its download or export control rather than saving the small preview. Check your browser's downloads list and whether it blocked the download. Sign in to the account that owns the result, reload the original workspace, and try the download again.", "If it still fails, email support with the job or session reference if available, your browser and device, and the exact error. Do not purchase again or regenerate solely to fix a download problem."]
      },
      {
        question: "The export is blurry, watermarked, or not the size I expected. What should I do?",
        paragraphs: ["Compare the exported file, not just the preview, with the resolution and export options selected in the workflow. Available sizes and watermark-free exports depend on the feature and plan. If an export does not match the options you selected, send support the original result reference, expected dimensions, actual file dimensions, and a screenshot or sample so we can investigate."],
        links: [{ href: "/docs", label: "Creative workflow guides" }]
      }
    ]
  }
];

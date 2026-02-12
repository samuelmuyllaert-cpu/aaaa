#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// --- Apollo.io API Client ---

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";

function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    throw new Error(
      "APOLLO_API_KEY environment variable is required. " +
        "Get your API key from Apollo.io: Settings > Integrations > API."
    );
  }
  return key;
}

async function apolloRequest(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: Record<string, unknown>,
  queryParams?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${APOLLO_BASE_URL}${path}`);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "x-api-key": getApiKey(),
  };

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Apollo API error ${response.status}: ${errorText}`
    );
  }

  return response.json();
}

// --- MCP Server ---

const server = new McpServer({
  name: "apollo-io",
  version: "1.0.0",
});

// --- People Tools ---

server.registerTool("search_people", {
  title: "Search People",
  description:
    "Search for people in Apollo.io's database using filters like job title, location, seniority, and organization domain. Returns basic profile info (no emails/phone numbers — use enrich_person for that).",
  inputSchema: {
    person_titles: z
      .array(z.string())
      .optional()
      .describe('Job titles to filter on, e.g. ["sales director", "CEO"]'),
    person_locations: z
      .array(z.string())
      .optional()
      .describe('Locations to filter on, e.g. ["California, US", "New York, US"]'),
    person_seniorities: z
      .array(z.string())
      .optional()
      .describe(
        'Seniority levels: "c_suite", "head", "director", "manager", "senior", "entry"'
      ),
    q_organization_domains_list: z
      .array(z.string())
      .optional()
      .describe('Organization domains to filter on, e.g. ["apollo.io", "google.com"]'),
    include_similar_titles: z
      .boolean()
      .optional()
      .describe("Expand search to include similar job titles"),
    per_page: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Results per page (max 100)"),
    page: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("Page number (max 500)"),
  },
}, async (params) => {
  const body: Record<string, unknown> = {};
  if (params.person_titles) body.person_titles = params.person_titles;
  if (params.person_locations) body.person_locations = params.person_locations;
  if (params.person_seniorities) body.person_seniorities = params.person_seniorities;
  if (params.q_organization_domains_list)
    body.q_organization_domains_list = params.q_organization_domains_list;
  if (params.include_similar_titles !== undefined)
    body.include_similar_titles = params.include_similar_titles;
  if (params.per_page) body.per_page = params.per_page;
  if (params.page) body.page = params.page;

  const result = await apolloRequest("POST", "/mixed_people/api_search", body);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("enrich_person", {
  title: "Enrich Person",
  description:
    "Enrich data for a single person using Apollo.io. Provide as much identifying info as possible (name, email, domain, LinkedIn URL) for best match results. Can reveal personal emails and phone numbers.",
  inputSchema: {
    first_name: z.string().optional().describe("Person's first name"),
    last_name: z.string().optional().describe("Person's last name"),
    email: z.string().optional().describe("Person's email address"),
    domain: z.string().optional().describe("Person's company domain, e.g. apollo.io"),
    organization_name: z
      .string()
      .optional()
      .describe("Person's company name"),
    linkedin_url: z
      .string()
      .optional()
      .describe("Person's LinkedIn profile URL"),
    reveal_personal_emails: z
      .boolean()
      .optional()
      .describe("Set to true to include personal email addresses"),
    reveal_phone_number: z
      .boolean()
      .optional()
      .describe("Set to true to include phone numbers"),
  },
}, async (params) => {
  const body: Record<string, unknown> = {};
  if (params.first_name) body.first_name = params.first_name;
  if (params.last_name) body.last_name = params.last_name;
  if (params.email) body.email = params.email;
  if (params.domain) body.domain = params.domain;
  if (params.organization_name) body.organization_name = params.organization_name;
  if (params.linkedin_url) body.linkedin_url = params.linkedin_url;
  if (params.reveal_personal_emails !== undefined)
    body.reveal_personal_emails = params.reveal_personal_emails;
  if (params.reveal_phone_number !== undefined)
    body.reveal_phone_number = params.reveal_phone_number;

  const result = await apolloRequest("POST", "/people/match", body);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("bulk_enrich_people", {
  title: "Bulk Enrich People",
  description:
    "Enrich data for up to 10 people in a single API call. Provide an array of person details.",
  inputSchema: {
    details: z
      .array(
        z.object({
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          email: z.string().optional(),
          domain: z.string().optional(),
          organization_name: z.string().optional(),
          linkedin_url: z.string().optional(),
        })
      )
      .min(1)
      .max(10)
      .describe("Array of person details to enrich (max 10)"),
    reveal_personal_emails: z.boolean().optional(),
    reveal_phone_number: z.boolean().optional(),
  },
}, async (params) => {
  const body: Record<string, unknown> = {
    details: params.details,
  };
  if (params.reveal_personal_emails !== undefined)
    body.reveal_personal_emails = params.reveal_personal_emails;
  if (params.reveal_phone_number !== undefined)
    body.reveal_phone_number = params.reveal_phone_number;

  const result = await apolloRequest("POST", "/people/bulk_match", body);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

// --- Organization Tools ---

server.registerTool("search_organizations", {
  title: "Search Organizations",
  description:
    "Search for organizations/companies in Apollo.io's database using filters. Note: this endpoint consumes credits.",
  inputSchema: {
    organization_domains: z
      .array(z.string())
      .optional()
      .describe('Domains to search for, e.g. ["google.com"]'),
    organization_locations: z
      .array(z.string())
      .optional()
      .describe('Locations, e.g. ["San Francisco, US"]'),
    organization_num_employees_ranges: z
      .array(z.string())
      .optional()
      .describe('Employee count ranges, e.g. ["1,10", "11,50", "51,200"]'),
    q_organization_keyword_tags: z
      .array(z.string())
      .optional()
      .describe('Industry/keyword tags, e.g. ["technology", "saas"]'),
    per_page: z.number().min(1).max(100).optional(),
    page: z.number().min(1).max(500).optional(),
  },
}, async (params) => {
  const body: Record<string, unknown> = {};
  if (params.organization_domains)
    body.organization_domains = params.organization_domains;
  if (params.organization_locations)
    body.organization_locations = params.organization_locations;
  if (params.organization_num_employees_ranges)
    body.organization_num_employees_ranges = params.organization_num_employees_ranges;
  if (params.q_organization_keyword_tags)
    body.q_organization_keyword_tags = params.q_organization_keyword_tags;
  if (params.per_page) body.per_page = params.per_page;
  if (params.page) body.page = params.page;

  const result = await apolloRequest("POST", "/mixed_companies/search", body);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("enrich_organization", {
  title: "Enrich Organization",
  description:
    "Enrich data for a single organization/company using its domain.",
  inputSchema: {
    domain: z.string().describe("The company domain to enrich, e.g. apollo.io"),
  },
}, async (params) => {
  const result = await apolloRequest("GET", "/organizations/enrich", undefined, {
    domain: params.domain,
  });
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

// --- Contact Tools ---

server.registerTool("search_contacts", {
  title: "Search Contacts",
  description:
    "Search for contacts that have been added to your Apollo account. Contacts are people your team has explicitly added and enriched.",
  inputSchema: {
    q_keywords: z.string().optional().describe("Keywords to search for"),
    contact_stage_ids: z
      .array(z.string())
      .optional()
      .describe("Filter by contact stage IDs"),
    sort_by_field: z
      .string()
      .optional()
      .describe('Field to sort by, e.g. "contact_last_activity_date"'),
    sort_ascending: z.boolean().optional().describe("Sort ascending (default false)"),
    per_page: z.number().min(1).max(100).optional(),
    page: z.number().min(1).max(500).optional(),
  },
}, async (params) => {
  const body: Record<string, unknown> = {};
  if (params.q_keywords) body.q_keywords = params.q_keywords;
  if (params.contact_stage_ids) body.contact_stage_ids = params.contact_stage_ids;
  if (params.sort_by_field) body.sort_by_field = params.sort_by_field;
  if (params.sort_ascending !== undefined) body.sort_ascending = params.sort_ascending;
  if (params.per_page) body.per_page = params.per_page;
  if (params.page) body.page = params.page;

  const result = await apolloRequest("POST", "/contacts/search", body);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("create_contact", {
  title: "Create Contact",
  description: "Create a new contact in your Apollo account.",
  inputSchema: {
    first_name: z.string().describe("Contact's first name"),
    last_name: z.string().describe("Contact's last name"),
    email: z.string().optional().describe("Contact's email address"),
    organization_name: z.string().optional().describe("Contact's company name"),
    title: z.string().optional().describe("Contact's job title"),
    phone: z.string().optional().describe("Contact's phone number"),
    website_url: z.string().optional().describe("Contact's website URL"),
    linkedin_url: z.string().optional().describe("Contact's LinkedIn profile URL"),
  },
}, async (params) => {
  const result = await apolloRequest("POST", "/contacts", params);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("update_contact", {
  title: "Update Contact",
  description: "Update an existing contact in your Apollo account.",
  inputSchema: {
    contact_id: z.string().describe("The ID of the contact to update"),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().optional(),
    organization_name: z.string().optional(),
    title: z.string().optional(),
    phone: z.string().optional(),
    website_url: z.string().optional(),
    linkedin_url: z.string().optional(),
  },
}, async (params) => {
  const { contact_id, ...updateFields } = params;
  const result = await apolloRequest(
    "PATCH",
    `/contacts/${contact_id}`,
    updateFields
  );
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

// --- Account Tools ---

server.registerTool("search_accounts", {
  title: "Search Accounts",
  description:
    "Search for accounts (companies) in your Apollo account.",
  inputSchema: {
    q_keywords: z.string().optional().describe("Keywords to search for"),
    sort_by_field: z.string().optional().describe("Field to sort by"),
    sort_ascending: z.boolean().optional(),
    per_page: z.number().min(1).max(100).optional(),
    page: z.number().min(1).max(500).optional(),
  },
}, async (params) => {
  const body: Record<string, unknown> = {};
  if (params.q_keywords) body.q_keywords = params.q_keywords;
  if (params.sort_by_field) body.sort_by_field = params.sort_by_field;
  if (params.sort_ascending !== undefined) body.sort_ascending = params.sort_ascending;
  if (params.per_page) body.per_page = params.per_page;
  if (params.page) body.page = params.page;

  const result = await apolloRequest("POST", "/accounts/search", body);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("create_account", {
  title: "Create Account",
  description: "Create a new account (company) in your Apollo account.",
  inputSchema: {
    name: z.string().describe("Company name"),
    domain: z.string().optional().describe("Company domain, e.g. google.com"),
    phone: z.string().optional().describe("Company phone number"),
    website_url: z.string().optional().describe("Company website URL"),
  },
}, async (params) => {
  const result = await apolloRequest("POST", "/accounts", params);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

// --- Sequence Tools ---

server.registerTool("search_sequences", {
  title: "Search Sequences",
  description:
    "Search for email sequences in your Apollo account. Requires a master API key.",
  inputSchema: {
    q_keywords: z.string().optional().describe("Keywords to search for"),
    per_page: z.number().min(1).max(100).optional(),
    page: z.number().min(1).optional(),
  },
}, async (params) => {
  const body: Record<string, unknown> = {};
  if (params.q_keywords) body.q_keywords = params.q_keywords;
  if (params.per_page) body.per_page = params.per_page;
  if (params.page) body.page = params.page;

  const result = await apolloRequest("POST", "/emailer_campaigns/search", body);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("add_contacts_to_sequence", {
  title: "Add Contacts to Sequence",
  description:
    "Add one or more contacts to an email sequence. Only contacts (not prospects) can be added.",
  inputSchema: {
    emailer_campaign_id: z.string().describe("The sequence ID to add contacts to"),
    contact_ids: z
      .array(z.string())
      .min(1)
      .describe("Array of contact IDs to add to the sequence"),
    send_email_from_email_account_id: z
      .string()
      .describe("The email account ID to send emails from"),
  },
}, async (params) => {
  const result = await apolloRequest(
    "POST",
    "/emailer_campaigns/add_contact_ids",
    {
      emailer_campaign_id: params.emailer_campaign_id,
      contact_ids: params.contact_ids,
      send_email_from_email_account_id: params.send_email_from_email_account_id,
    }
  );
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

// --- Deal Tools ---

server.registerTool("list_deals", {
  title: "List Deals",
  description: "List deals in your Apollo account.",
  inputSchema: {
    per_page: z.number().min(1).max(100).optional(),
    page: z.number().min(1).optional(),
  },
}, async (params) => {
  const queryParams: Record<string, string> = {};
  if (params.per_page) queryParams.per_page = String(params.per_page);
  if (params.page) queryParams.page = String(params.page);

  const result = await apolloRequest("GET", "/deals", undefined, queryParams);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("create_deal", {
  title: "Create Deal",
  description: "Create a new deal in your Apollo account.",
  inputSchema: {
    name: z.string().describe("Deal name"),
    amount: z.number().optional().describe("Deal amount/value"),
    deal_stage_id: z.string().optional().describe("Deal stage ID"),
    contact_ids: z
      .array(z.string())
      .optional()
      .describe("Contact IDs associated with the deal"),
    account_id: z.string().optional().describe("Account ID associated with the deal"),
    owner_id: z.string().optional().describe("User ID of the deal owner"),
  },
}, async (params) => {
  const result = await apolloRequest("POST", "/deals", params);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

// --- Utility Tools ---

server.registerTool("get_api_usage", {
  title: "Get API Usage",
  description:
    "View your Apollo API usage statistics and rate limits.",
  inputSchema: {},
}, async () => {
  const result = await apolloRequest("POST", "/usage");
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("list_users", {
  title: "List Users",
  description: "Get a list of users in your Apollo organization.",
  inputSchema: {},
}, async () => {
  const result = await apolloRequest("GET", "/users");
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("list_email_accounts", {
  title: "List Email Accounts",
  description: "Get a list of email accounts connected to your Apollo organization.",
  inputSchema: {},
}, async () => {
  const result = await apolloRequest("GET", "/email_accounts");
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Apollo.io MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

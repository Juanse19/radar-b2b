/**
 * lib/apollo/types.ts — Shared types for Apollo.io request/response shapes.
 * Only the fields we actually consume are typed; the rest is unknown.
 */

export interface ApolloOrganizationLite {
  id?:           string;
  name?:         string;
  primary_domain?: string;
  website_url?:  string;
}

export interface ApolloPhoneNumber {
  raw_number?:    string;
  sanitized_number?: string;
  type?:          'work' | 'mobile' | 'home_phone' | 'other' | string;
  position?:      number;
  status?:        string;
  dnc_status?:    string;
}

/** Person object as returned by mixed_people/api_search. */
export interface ApolloPersonSearch {
  id:               string;
  first_name?:      string;
  last_name?:       string;
  name?:            string;
  title?:           string;
  seniority?:       string;
  linkedin_url?:    string;
  photo_url?:       string;
  organization?:    ApolloOrganizationLite;
  organization_id?: string;
  city?:            string;
  state?:           string;
  country?:         string;
  /** Search results return only `email_status` ("verified", "extrapolated", etc.) but rarely the address. */
  email_status?:    string;
  email?:           string;
}

/** Person object as returned by people/bulk_match (richer than search). */
export interface ApolloPersonEnriched extends ApolloPersonSearch {
  email_status?:    string;
  phone_numbers?:   ApolloPhoneNumber[];
  /** Reveal flow may include this when `reveal_phone_number=true`. */
  sanitized_phone?: string;
  organization_phone?: string;
}

export interface ApolloSearchResponse {
  people?: ApolloPersonSearch[];
  pagination?: {
    page?:     number;
    per_page?: number;
    total_entries?: number;
    total_pages?:   number;
  };
}

export interface ApolloBulkMatchResponse {
  matches?: ApolloPersonEnriched[];
}

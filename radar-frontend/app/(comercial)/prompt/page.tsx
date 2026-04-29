import { redirect } from 'next/navigation';

export default function PromptRedirectPage() {
  redirect('/admin/prompts');
}

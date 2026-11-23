import { redirect } from 'next/navigation';

/** The old analytics page is now the admin console overview. */
export default function AdminAnalyticsRedirect() {
  redirect('/admin');
}

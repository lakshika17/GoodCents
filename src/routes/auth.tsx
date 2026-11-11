import { createFileRoute } from '@tanstack/react-router';
import { AuthScreen } from '@/components/auth-screen';
import { pageHead } from '@/lib/meta';
export const Route = createFileRoute('/auth')({ head: pageHead('Employee Sign In','Sign in to GoodCents.'), component: AuthScreen });
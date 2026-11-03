import { createFileRoute } from '@tanstack/react-router';
import { AuthScreen } from '@/components/auth-screen';
import { pageHead } from '@/lib/meta';
export const Route = createFileRoute('/auth')({ head: pageHead('Employee Sign In','Invitation-only Quantera Analytical employee access.'), component: AuthScreen });
import { redirect } from "next/navigation";
export default async function Share({ params }: {
    params: Promise<{
        token: string;
    }>;
}) { redirect(`https://vismuse.com/share/${encodeURIComponent((await params).token)}`); }

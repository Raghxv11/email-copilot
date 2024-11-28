// /api/aurinko/callack

import { NextResponse, NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { exchangeCodeForAccessToken } from "@/lib/aurinko"
import { getAccountDetails } from "@/lib/aurinko"
import { db } from "@/server/db"

export const GET = async (req: NextRequest) => {
    const {userId} = await auth()
    if (!userId) {
        return NextResponse.json({message: 'Unauthorized'}, {status: 401})
    }

    // Check if the user exists
    const existingUser = await db.user.findUnique({
        where: { id: userId }
    });

    // Create the user if they do not exist
    if (!existingUser) {
        await db.user.create({
            data: {
                id: userId,
                emailAddress: '', // You may need to provide an email address
                firstName: '',    // Provide first name if available
                lastName: '',     // Provide last name if available
                imageUrl: ''      // Provide image URL if available
            }
        });
    }

    const params= req.nextUrl.searchParams
    const status = params.get('status')
    if (status !== 'success') {
        return NextResponse.json({message: 'Failed to link account'}, {status: 400})
    }
    //get the code to exchange for an access token
    const code = params.get('code')
    if (!code) {
        return NextResponse.json({message: 'Code not found'}, {status: 400})
    }
    const token = await exchangeCodeForAccessToken(code)
    if (!token) {
        return NextResponse.json({message: 'Failed to exchange code for access token'}, {status: 400})
    }

    const accountDetails = await getAccountDetails(token.accessToken)
    await db.account.upsert({
        where: {id: token.accountId.toString()},
        update: {access_token: token.accessToken},
        create: {
            id: token.accountId.toString(),
            userId,
            emailAddress: accountDetails.email,
            name: accountDetails.name,
            access_token: token.accessToken,
        }
    })

    //initial sync

    return NextResponse.redirect(new URL('/mail', req.url))
}
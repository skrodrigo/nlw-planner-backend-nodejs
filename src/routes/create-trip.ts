import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma";
import { getMailClient } from "../lib/mail";
import { dayjs } from "../lib/dayjs";
import { ClientError } from "../erros/client-error";
import { env } from "../env";


export async function createTrip(app: FastifyInstance){
    app.withTypeProvider<ZodTypeProvider>().post('/trips', {
        schema: { 
            body: z.object({
                destination: z.string().min(4),
                starts_at: z.coerce.date(),
                ends_at: z.coerce.date(),
                owner_name: z.string(),
                owner_email: z.string().email(),
                emails_to_invite: z.array(z.string().email())
            })
        },

    }, async (req) => {
        const { destination, starts_at, ends_at, owner_email, owner_name, emails_to_invite } = req.body

        if (dayjs(starts_at).isBefore(new Date())) {
            throw new ClientError("Invalid Trip Start Date")
        }

        if (dayjs(ends_at).isBefore(starts_at)) {
            throw new ClientError("Invalid Trip End Date")
        }

        const trip = await prisma.trip.create({
            data: {
                destination,
                starts_at,
                ends_at,
                participants: {
                    createMany: {
                        data: [
                            {
                                name: owner_name,
                                email: owner_email,
                                is_owner: true,
                                is_confirmed: true
                            },
                            ...emails_to_invite.map(email => {
                                return { email }
                            })
                        ]
                    }
                }
            }
        })

        await prisma.participant.create({
            data:{
                trip_id: trip.id,
                name: owner_name,
                email: owner_email
            }
        })

        const formatedStartsAt = dayjs(starts_at).format('LL')
        const formatedEndDate = dayjs(ends_at).format('LL')
        const confirmationLink = `${env.API_BASE_URL}/trips/${trip.id}/confirm`


        const mail = await getMailClient()
        
        const message = await mail.sendMail({
            from: {
                name: "Trip Planner",
                address: 'oi@planner.com',
                },
            to: {
                name: owner_name,
                address: owner_email
                },
            subject: `Confirme sua viagem para ${destination} em ${formatedStartsAt} até ${formatedEndDate}`,
            html: 
            `<h1> Você solicitou uma viagem para ${destination} </h1> para as datas de ${formatedStartsAt} até ${formatedEndDate}, confirme sua viagem 
            pelo link <a href="${confirmationLink}">Clique aqui para confirmar sua viagem</a>`.trim()
        })

        console.log(nodemailer.getTestMessageUrl(message))

        return { tripId: trip.id } 
    })

}
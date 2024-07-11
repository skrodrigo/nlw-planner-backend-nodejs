import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import nodemailer from "nodemailer";

import { z } from "zod";

import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import { prisma } from "../lib/prisma";
import { ClientError } from "../erros/client-error";
import { env } from "../env";

export async function confirmTrip(app: FastifyInstance){
    app.withTypeProvider<ZodTypeProvider>().get('/trips/:tripId/confirm', {
        schema: { 
            params: z.object({
                tripId: z.string().uuid(),
            })
        },

    }, async (request, reply) => {
        const { tripId } = request.params

        const trip = await prisma.trip.findUnique({
            where: {
                id: tripId
            },
            include: {
                participants: {
                    where: {
                        is_owner: false
                    }
                }
            }
        })

        if (!trip) {
            throw new ClientError("Trip not found")
        }
        
        if (trip.is_confirmed) {
            return reply.redirect(`${env.WEB_BASE_URL}/trips/${tripId}`)
        }
        
        await prisma.trip.update({
            where: {
                id: tripId
            },
            data: {
                is_confirmed: true
            }
        })

        const formatedStartsAt = dayjs(trip.starts_at).format('LL')
        const formatedEndDate = dayjs(trip.ends_at).format('LL')


        const mail = await getMailClient()  

        await Promise.all(
            trip.participants.map(async (participant) => {
                const confirmationLink = `${env.API_BASE_URL}/participants/${participant.id}/confirm`

                const message = await mail.sendMail({
                    from: {
                        name: "Trip Planner",
                        address: 'oi@planner.com',
                        },

                    to: participant.email,

                    subject: `Confirme sua presença na viagem para ${trip.destination} em ${formatedStartsAt} até ${formatedEndDate}`,
                    html: 
                    `<h1> Você foi convidado para participar de uma viagem para ${trip.destination} </h1> para as datas de ${formatedStartsAt} até ${formatedEndDate}, confirme sua viagem 
                    pelo link <a href="${confirmationLink}">Clique aqui para confirmar sua viagem</a>`.trim()
                })
        
                console.log(nodemailer.getTestMessageUrl(message))
            }))

            return reply.redirect(`${env.WEB_BASE_URL}/trips/${tripId}`)

    })

}
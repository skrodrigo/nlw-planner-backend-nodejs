import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import nodemailer from "nodemailer";
import { z } from "zod";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import { prisma } from "../lib/prisma";
import { ClientError } from "../erros/client-error";
import { env } from "../env";

export async function createInvite(app: FastifyInstance){
    app.withTypeProvider<ZodTypeProvider>().post('/trips/:tripId/invites', {
        schema: { 
            params: z.object({
              tripId: z.string().uuid()
            }),
            body: z.object({
                email: z.string().email(),
            })
        },

    }, async (req) => {
        const { tripId } = req.params
        const { email } = req.body

        const trip = await prisma.trip.findUnique({
            where: { id: tripId }
        })

        if (!trip) {
            throw new ClientError("Trip not found")
        }

        const participant = await prisma.participant.create({

          data:{
            email,
            trip_id: trip.id  
          }

        })

        const formatedStartsAt = dayjs(trip.starts_at).format('LL')
        const formatedEndDate = dayjs(trip.ends_at).format('LL')


        const mail = await getMailClient()  

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
                
        return { participantId: participant.id } 
    })

}
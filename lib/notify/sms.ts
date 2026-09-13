import Twilio from 'twilio';
export const smsConfigured=()=>Boolean(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_FROM_NUMBER);
export async function sendAgreementSms(to:string,body:string):Promise<{sent:boolean;sid?:string;reason?:string}>{
 if(!smsConfigured()){console.log('[sms:noop]',to,body);return {sent:false,reason:'not_configured'};}
 try{
  const client=Twilio(process.env.TWILIO_ACCOUNT_SID!,process.env.TWILIO_AUTH_TOKEN!);
  const message=await client.messages.create({to,from:process.env.TWILIO_FROM_NUMBER!,body});
  return {sent:true,sid:message.sid};
 }catch(e){console.error('[sms:error]',e);return {sent:false,reason:e instanceof Error?e.message:'Unknown SMS error'};}
}

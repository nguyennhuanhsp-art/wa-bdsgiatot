import {NextResponse,type NextRequest} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
function equals(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());}
export function proxy(request:NextRequest){
 if(process.env.APP_MODE!=='hosted-demo')return NextResponse.next();
 const user=process.env.DEMO_ACCESS_USER,password=process.env.DEMO_ACCESS_PASSWORD;
 const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
 if(!user||!password||password.length<32)return new NextResponse('Demo configuration unavailable.',{status:503,headers});
 const auth=request.headers.get('authorization')||'';
 let valid=false;
 if(/^Basic /i.test(auth)&&auth.length<2048){try{const decoded=Buffer.from(auth.slice(6),'base64').toString('utf8');valid=equals(decoded,`${user}:${password}`);}catch{}}
 if(!valid)return new NextResponse('This demo requires the access credentials supplied with your invitation.',{status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="bdsgiatot demo", charset="UTF-8"'}});
 const result=NextResponse.next();for(const [key,value]of Object.entries(headers))result.headers.set(key,value);return result;
}
export const config={matcher:'/:path*'};

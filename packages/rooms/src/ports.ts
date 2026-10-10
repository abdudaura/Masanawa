import type {RoomPreview,RoomQuestion} from "./index.js";
export interface RoomActor {tenantId:string;userId:string|null;roles:readonly string[];}
export interface RoomsRepository {
 list(actor:RoomActor,filters:{joined?:boolean;search?:string;language?:string}):Promise<RoomPreview[]>;
 get(actor:RoomActor,id:string):Promise<RoomPreview|null>;
 staffRooms(actor:RoomActor):Promise<RoomPreview[]>;
 staffRoom(actor:RoomActor,id:string):Promise<RoomPreview|null>;
 create(actor:RoomActor,input:{title:string;slug:string;teacherCharacterId:string;language:string}):Promise<RoomPreview>;
 publish(actor:RoomActor,id:string,eligibleMasana:boolean):Promise<void>;
 join(actor:RoomActor,id:string):Promise<void>;
 leave(actor:RoomActor,id:string):Promise<void>;
 ask(actor:RoomActor,id:string,body:string,key:string):Promise<RoomQuestion>;
 questions(actor:RoomActor,id:string):Promise<RoomQuestion[]>;
 question(actor:RoomActor,id:string,questionId:string):Promise<RoomQuestion|null>;
 staffQueue(actor:RoomActor):Promise<RoomQuestion[]>;
 review(actor:RoomActor,questionId:string,answer:string,decision:"approve"|"reject"):Promise<void>;
 lessons(actor:RoomActor,id:string):Promise<Array<{lessonId:string;body:string;kind:string}>>;
 createLesson(actor:RoomActor,id:string,body:string,kind:"lesson"|"announcement"):Promise<void>;
}

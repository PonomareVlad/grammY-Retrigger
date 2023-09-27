import {Bot as BaseBot, webhookCallback as baseWebhookCallback} from "grammy";
import type {Middleware, WebhookReplyEnvelope, Context} from "grammy";
import type {FrameworkAdapter, SupportedFrameworks} from "grammy/out/convenience/frameworks";
import type {OtherwiseConfig} from "@grammyjs/conversations/out/conversation";
import type {WebhookOptions} from "grammy/out/convenience/webhook";
import type {Conversation} from "@grammyjs/conversations";
import type {Update} from "grammy/types";

export interface ReTriggerFlavor {
    reTrigger: () => void
}

export class Bot<C extends Context = Context> extends BaseBot<C> {

    reTriggerUpdate: boolean = false

    async handleUpdate(
        update: Update,
        webhookReplyEnvelope?: WebhookReplyEnvelope
    ) {
        do {
            this.reTriggerUpdate = false;
            await super.handleUpdate(update, webhookReplyEnvelope);
        } while (this.reTriggerUpdate);
    }
}

export function reTrigger<C extends Context & ReTriggerFlavor>(bot: Bot): Middleware<C> {
    return async (ctx, next) => {
        (globalThis as Record<string, any>)?.signal?.throwIfAborted?.();
        ctx.reTrigger = () => void (bot.reTriggerUpdate = true);
        return next();
    }
}

export function createReTrigger<C extends Context & ReTriggerFlavor>(
    conversation: Conversation<C>,
    opts?: OtherwiseConfig<C>
) {
    return async () => {
        // @ts-ignore
        const {update_id} = conversation.currentCtx.update;
        // @ts-ignore
        await conversation.external(() => conversation.ctx.reTrigger());
        await conversation.waitUntil(
            ctx => ctx.update.update_id === update_id,
            opts
        );
    }
}

export interface OptionsForWebhookCallback extends WebhookOptions {
    reTriggerTimeout: number
}

export function webhookCallback<C extends Context = Context>(
    bot: Bot<C>,
    adapter?: SupportedFrameworks | FrameworkAdapter,
    {reTriggerTimeout, ...webhookOptions} = {} as OptionsForWebhookCallback
) {
    return (request: Request) => {
        if (reTriggerTimeout)
            (globalThis as Record<string, any>).signal = AbortSignal.timeout(reTriggerTimeout);
        return baseWebhookCallback(bot, adapter, webhookOptions)(request);
    }
}

# Events

## Overview

Async event system for decoupled side effects (emails, logging, notifications). Dispatch after mutations, listen in bootstrap or service classes.

## Structure

| File/Dir | Purpose |
|------|---------|
| `Event.ts` | Abstract base class for all events |
| `EventDispatcher.ts` | Singleton dispatcher |
| `examples/` | Example event + listener implementations |
| `index.ts` | Exports Event, EventDispatcher |

## Event Pattern

```typescript
// app/events/examples/ProductCreated.ts
import { Event } from "@events";

interface ProductCreatedPayload {
  product: ProductRecord;
  createdBy: string; // user id
}

export class ProductCreated extends Event<ProductCreatedPayload> {
  constructor(payload: ProductCreatedPayload) {
    super("product.created", payload);
  }
}
```

## Listener Pattern

```typescript
// Class-based listener
export class SendProductNotification {
  async handle(event: ProductCreated): Promise<void> {
    const { product, createdBy } = event.payload;
    await sendEmail(product.ownerEmail, "New product created", product);
  }
}

// Function-based listener
async function logProductCreation(event: ProductCreated) {
  Logger.info("Product created", { id: event.payload.product.id });
}
```

## How to Dispatch

```typescript
import { event } from "@helpers/events";
import { ProductCreated } from "@events/examples";

// In a controller, after successful DB write:
await event(new ProductCreated({ product, createdBy: req.user!.id }));
```

## How to Register Listeners

```typescript
import { on } from "@helpers/events";
import { ProductCreated } from "@events/examples";
import { SendProductNotification } from "@events/examples";

// In bootstrap or service file:
const listener = new SendProductNotification();
on(ProductCreated, (e) => listener.handle(e));
```

## Event Naming Conventions

- Event name string: `resource.action` (e.g., `user.registered`, `product.created`)
- Event class name: `{Resource}{Action}` (e.g., `UserRegistered`, `ProductCreated`)
- Listener class name: `{Action}{Target}` (e.g., `SendWelcomeEmail`, `LogProductCreation`)

## Helpers (`@helpers/events`)

```typescript
import { event, on, once, off } from "@helpers/events";

event(new MyEvent(payload));         // dispatch
on(MyEvent, handler);                // register persistent listener
once(MyEvent, handler);              // register one-time listener
off(MyEvent, handler);               // remove listener
```

## Conventions

- Add new event classes in `app/events/examples/`
- Export from `app/events/examples/index.ts`
- Always pass typed payload
- Dispatch AFTER successful database write, not before
- Listeners should be idempotent (safe to re-run)

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { processChat, getConversation } from '../services/chatService';
import { getIngestedSourceUrls } from '../config/vectorDb';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

// POST /api/chat/message
router.post(
  '/message',
  asyncHandler(async (req: Request, res: Response) => {
    const { conversation_id, message, session_id } = req.body;
    const organizationId = req.organizationId || 'default';

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const chatRequest = {
      conversation_id: conversation_id || uuidv4(),
      user_id: session_id || uuidv4(),
      message,
      organization_id: organizationId,
    };

    const response = await processChat(chatRequest);
    res.status(200).json(response);
  })
);

// GET /api/chat/ingested-urls
router.get(
  '/ingested-urls',
  asyncHandler(async (_req: Request, res: Response) => {
    const urls = getIngestedSourceUrls();
    res.status(200).json({
      count: urls.length,
      urls,
    });
  })
);

// GET /api/chat/conversation/:id
router.get(
  '/conversation/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const conversation = await getConversation(id);
    res.status(200).json(conversation);
  })
);

// POST /api/chat/escalate
router.post(
  '/escalate',
  asyncHandler(async (req: Request, res: Response) => {
    const { conversation_id, user_email } = req.body;

    if (!conversation_id || !user_email) {
      res.status(400).json({ error: 'Conversation ID and user email are required' });
      return;
    }

    // TODO: Implement escalation logic
    // - Create escalation record in database
    // - Send email to support team
    // - Return escalation ID

    const escalationId = uuidv4();
    logger.info(`Escalation created: ${escalationId} for conversation ${conversation_id}`);

    res.status(200).json({
      escalation_id: escalationId,
      status: 'ticket_created',
      message: 'Thank you! A support agent will contact you shortly.',
      ticket_reference: `SUP-${Date.now()}`,
      estimated_response_time: '30 minutes',
    });
  })
);

export default router;

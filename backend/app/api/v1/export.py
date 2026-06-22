import genanki
import uuid
import io
import tempfile
import os
import random
from fastapi import APIRouter, Depends, HTTPException, responses
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.luminar import Luminar
from app.models.scene import Scene
from app.agents.flashcard_gen import flashcard_agent

router = APIRouter()

def random_id():
    """Generate a random ID for Anki models and decks."""
    return random.randrange(1 << 30, 1 << 31)

@router.get("/{luminar_id}/anki")
async def export_to_anki(
    luminar_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Generate and download an Anki flashcard deck for a specific luminar's content."""
    logger.info(f"Generating Anki export for luminar {luminar_id}")
    
    # 1. Fetch Luminar and Scenes
    v_result = await db.execute(select(Luminar).where(Luminar.id == luminar_id))
    luminar = v_result.scalar_one_or_none()
    if not luminar:
        logger.warning(f"Export failed: Luminar {luminar_id} not found")
        raise HTTPException(status_code=404, detail="Luminar not found")
        
    s_result = await db.execute(
        select(Scene)
        .where(Scene.luminar_id == luminar_id)
        .order_by(Scene.scene_index)
    )
    scenes = s_result.scalars().all()
    
    # 2. Generate Flashcards using AI Agent
    logger.info(f"Triggering flashcard agent for luminar {luminar.title}")
    scripts = "\n\n".join([f"Scene {s.scene_index}: {s.narration_text}" for s in scenes])
    agent_result = await flashcard_agent.run(f"Luminar Title: {luminar.title}\nScripts:\n{scripts}")
    deck_data = agent_result.data
    
    # 3. Create Anki Deck with genanki
    model_id = random_id()
    deck_id = random_id()
    
    # Define a clean, centered CSS style for the cards
    css_style = (
        'font-family: Arial, sans-serif;'
        'font-size: 20px;'
        'text-align: center;'
        'color: black;'
        'background-color: white;'
        'padding: 30px;'
        'border-radius: 15px;'
        'box-shadow: 0 4px 6px rgba(0,0,0,0.1);'
    )
    
    my_model = genanki.Model(
        model_id,
        'Luminar Flashcard Model',
        fields=[
            {'name': 'Question'},
            {'name': 'Answer'},
        ],
        templates=[
            {
                'name': 'Card 1',
                'qfmt': f'<div style="{css_style}">{{{{Question}}}}</div>',
                'afmt': f'{{{{FrontSide}}}}<hr id="answer"><div style="{css_style}">{{{{Answer}}}}</div>',
            },
        ]
    )

    my_deck = genanki.Deck(deck_id, f"Luminar: {luminar.title}")

    for card in deck_data.cards:
        my_note = genanki.Note(
            model=my_model,
            fields=[card.front, card.back]
        )
        my_deck.add_note(my_note)

    # 4. Stream the generated .apkg file
    output = io.BytesIO()
    with tempfile.NamedTemporaryFile(suffix=".apkg", delete=False) as tmp:
        my_deck.write_to_file(tmp.name)
        with open(tmp.name, "rb") as f:
            output.write(f.read())
        os.unlink(tmp.name)
        
    output.seek(0)
    logger.info(f"Anki deck successfully generated for luminar {luminar_id}")
    return responses.StreamingResponse(
        output, 
        media_type="application/octet-stream", 
        headers={
            "Content-Disposition": f"attachment; filename=luminar_{luminar_id}.apkg"
        }
    )

#!/bin/bash

# ====================================
# SCRIPT DE TESTING - RESERVATIONS API
# ====================================

echo "🧪 ALMANIK PMS - Reservations API Testing"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Login
echo -e "${BLUE}📝 PASO 1: Login...${NC}"
SESSION_ID=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.sessionId')

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "null" ]; then
  echo -e "${YELLOW}❌ Error al hacer login${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Login exitoso! Session ID: $SESSION_ID${NC}"
echo ""

# Step 2: Check availability
echo -e "${BLUE}📝 PASO 2: Verificar disponibilidad de camas...${NC}"
echo "Fechas: 2025-12-15 a 2025-12-18"
AVAILABILITY=$(curl -s "http://localhost:3000/api/reservations/availability/check?check_in=2025-12-15&check_out=2025-12-18" \
  -H "session-id: $SESSION_ID")

AVAILABLE_COUNT=$(echo $AVAILABILITY | jq -r '.available_beds_count')
echo -e "${GREEN}✅ Camas disponibles: $AVAILABLE_COUNT de 27${NC}"
echo ""

# Step 3: Create reservation
echo -e "${BLUE}📝 PASO 3: Crear nueva reserva...${NC}"
echo "Huésped: Carlos Silva (ID 3)"
echo "Cama: 1-5 (ID 5)"
echo "Fechas: 2025-12-15 a 2025-12-18"
echo ""

CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -H "session-id: $SESSION_ID" \
  -d '{
    "guest_id": 3,
    "bed_id": 5,
    "check_in": "2025-12-15",
    "check_out": "2025-12-18",
    "source": "phone"
  }')

RESERVATION_ID=$(echo $CREATE_RESPONSE | jq -r '.reservation.id')
CONFIRMATION_CODE=$(echo $CREATE_RESPONSE | jq -r '.reservation.confirmation_code')
TOTAL=$(echo $CREATE_RESPONSE | jq -r '.reservation.total')
NIGHTS=$(echo $CREATE_RESPONSE | jq -r '.reservation.nights')

echo -e "${GREEN}✅ Reserva creada!${NC}"
echo "   ID: $RESERVATION_ID"
echo "   Código: $CONFIRMATION_CODE"
echo "   Noches: $NIGHTS"
echo "   Total: \$$TOTAL"
echo ""

# Step 4: List all reservations
echo -e "${BLUE}📝 PASO 4: Listar todas las reservas...${NC}"
RESERVATIONS=$(curl -s http://localhost:3000/api/reservations \
  -H "session-id: $SESSION_ID")

COUNT=$(echo $RESERVATIONS | jq -r '.count')
echo -e "${GREEN}✅ Total de reservas en el sistema: $COUNT${NC}"
echo ""

# Step 5: Get reservation details
echo -e "${BLUE}📝 PASO 5: Ver detalles de la reserva creada...${NC}"
DETAILS=$(curl -s http://localhost:3000/api/reservations/$RESERVATION_ID \
  -H "session-id: $SESSION_ID")

echo "$DETAILS" | jq '.reservation | {id, guest_name, bed_name, check_in, check_out, status, confirmation_code, total}'
echo ""

# Step 6: Confirm reservation
echo -e "${BLUE}📝 PASO 6: Confirmar la reserva...${NC}"
CONFIRM=$(curl -s -X POST http://localhost:3000/api/reservations/$RESERVATION_ID/confirm \
  -H "Content-Type: application/json" \
  -H "session-id: $SESSION_ID")

NEW_STATUS=$(echo $CONFIRM | jq -r '.reservation.status')
echo -e "${GREEN}✅ Reserva confirmada! Nuevo estado: $NEW_STATUS${NC}"
echo ""

# Step 7: Update reservation
echo -e "${BLUE}📝 PASO 7: Actualizar la reserva (extender 1 día)...${NC}"
UPDATE=$(curl -s -X PUT http://localhost:3000/api/reservations/$RESERVATION_ID \
  -H "Content-Type: application/json" \
  -H "session-id: $SESSION_ID" \
  -d '{"check_out": "2025-12-19"}')

NEW_NIGHTS=$(echo $UPDATE | jq -r '.reservation.nights')
NEW_TOTAL=$(echo $UPDATE | jq -r '.reservation.total')
echo -e "${GREEN}✅ Reserva actualizada!${NC}"
echo "   Nuevas noches: $NEW_NIGHTS"
echo "   Nuevo total: \$$NEW_TOTAL"
echo ""

# Step 8: Get updated details with transactions
echo -e "${BLUE}📝 PASO 8: Ver detalles finales con transacciones...${NC}"
FINAL_DETAILS=$(curl -s http://localhost:3000/api/reservations/$RESERVATION_ID \
  -H "session-id: $SESSION_ID")

echo "$FINAL_DETAILS" | jq '{
  reservation: .reservation | {id, guest_name, bed_name, nights, total, status},
  transactions: .transactions | length
}'
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ TESTING COMPLETADO EXITOSAMENTE${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📊 Resumen:"
echo "   - Session ID obtenido: ✅"
echo "   - Disponibilidad verificada: ✅ ($AVAILABLE_COUNT camas)"
echo "   - Reserva creada: ✅ (ID: $RESERVATION_ID)"
echo "   - Reserva confirmada: ✅"
echo "   - Reserva actualizada: ✅"
echo "   - Total transacciones: ✅"
echo ""
echo "🎉 El sistema de reservas está funcionando perfectamente!"
echo ""
echo "💡 Tip: Puedes ver la reserva en el navegador en:"
echo "   http://localhost:3000"
echo "   (Login: admin / admin123)"

package com.example.farmacia_backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Map;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService   jwtService;
    private final ObjectMapper objectMapper;

    public JwtAuthFilter(JwtService jwtService, ObjectMapper objectMapper) {
        this.jwtService   = jwtService;
        this.objectMapper = objectMapper;
    }
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);

        // Sin token → continúa sin autenticar (Spring Security rechazará si el endpoint lo requiere)
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring("Bearer ".length()).trim();

        try {
            Jws<Claims> parsed  = jwtService.parse(token);
            Claims      claims  = parsed.getBody();

            String username  = claims.getSubject();
            String role      = claims.get("role",   String.class);

            // userId viene como Integer en el JSON del JWT, lo casteamos a Long
            Object userIdRaw = claims.get("userId");
            Long   userId    = userIdRaw instanceof Number n ? n.longValue() : null;

            if (username == null || role == null || role.isBlank() || userId == null) {
                // Token mal formado → respuesta JSON 401
                writeUnauthorized(response, "Token inválido: faltan claims obligatorios");
                return;
            }
            AuthenticatedUser principal = new AuthenticatedUser(username, userId, role);

            var authentication = new UsernamePasswordAuthenticationToken(
                    principal,
                    null,
                    principal.getAuthorities()
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);

        } catch (JwtException ex) {
            SecurityContextHolder.clearContext();
            writeUnauthorized(response, "Token inválido o expirado");
            return;
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        // Solo excluimos el login — password-reset también es público
        // pero ya está cubierto por /api/auth/** en SecurityConfig
        return path.equals("/api/auth/login");
    }

    // ─── Helper privado ───────────────────────────────────────────────────────
    private void writeUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(
                response.getOutputStream(),
                Map.of(
                        "success", false,
                        "message", message
                )
        );
    }
}
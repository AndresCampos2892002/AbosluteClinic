package com.example.farmacia_backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;

import java.util.Map;

@Configuration
public class SecurityHandlers {

    /**
     * 401 - Sin token o token inválido al llegar a un endpoint protegido.
     * Nota: tokens inválidos ya son interceptados por JwtAuthFilter antes
     * de llegar aquí. Este handler cubre el caso de requests sin token.
     */
    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint(ObjectMapper mapper) {
        return (HttpServletRequest request,
                HttpServletResponse response,
                AuthenticationException authException) -> {

            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");

            mapper.writeValue(
                    response.getOutputStream(),
                    Map.of(
                            "success", false,
                            "message", "Credenciales incorrectas o token ausente",
                            "path",    request.getRequestURI()
                    )
            );
        };
    }

    /**
     * 403 - Token válido pero el rol no tiene permiso para este endpoint.
     */
    @Bean
    public AccessDeniedHandler accessDeniedHandler(ObjectMapper mapper) {
        return (request, response, accessDeniedException) -> {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");

            mapper.writeValue(
                    response.getOutputStream(),
                    Map.of(
                            "success", false,
                            "message", "Acceso denegado: no tienes permisos",
                            "path",    request.getRequestURI()
                    )
            );
        };
    }
}